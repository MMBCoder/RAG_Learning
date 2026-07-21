/* Server-only Google Gemini client shared by the RAG API routes.

   Key: read from the GEMINI_API_KEY environment variable — set it in
   .env.local for local dev and in the Vercel project env for production.
   Never hardcode the key here (GitHub push protection blocks committed
   credentials, and the repo is public).

   Resilience: the free tier 503/429s under load, so chat calls walk a
   model-fallback chain (best flash first, lighter flashes next). This is
   the "fallback" tier; add an OpenRouter key later for cross-provider
   failover behind the same functions. */

import { openaiAvailable, openaiChat, openaiChatStream } from "./openai";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";

/** Chat model fallback chain — first that answers 200 wins. Ordered by
    observed free-tier reliability: the lite models serve instantly while
    gemini-flash-latest frequently 503s under load, so it's the last
    resort rather than the first try. Overridable via GEMINI_CHAT_MODELS
    (comma-separated) without a code change. */
const CHAT_MODELS =
  process.env.GEMINI_CHAT_MODELS?.split(",").map(s => s.trim()).filter(Boolean).length
    ? process.env.GEMINI_CHAT_MODELS!.split(",").map(s => s.trim()).filter(Boolean)
    : ["gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-flash-latest"];
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 768;
const EMBED_BATCH = 100;   // Gemini batchEmbedContents request cap

/** Per-attempt timeout so a hung model fails over instead of blocking. */
const ATTEMPT_MS = 15_000;

/** HTTP status codes worth failing over to the next model on. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** fetch with an abort timeout; a timeout throws like any network error
    and is treated as a retryable failure by the model loop. */
async function fetchTimeout(url: string, init: RequestInit, ms = ATTEMPT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class LlmError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function headers() {
  return { "Content-Type": "application/json", "X-goog-api-key": GEMINI_KEY };
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

interface GeminiPart { text?: string }
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

export interface GenerateResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

interface ChatOpts { temperature?: number; maxTokens?: number; jsonMode?: boolean }

function buildBody(system: string, user: string, opts: ChatOpts, stream: boolean): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: Math.min(Math.max(opts.maxTokens ?? 600, 64), 4000),
  };
  if (opts.temperature !== undefined) generationConfig.temperature = opts.temperature;
  if (opts.jsonMode) generationConfig.responseMimeType = "application/json";
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig,
  };
  if (system.trim()) body.system_instruction = { parts: [{ text: system }] };
  void stream;
  return body;
}

function extractText(data: GeminiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map(p => p.text ?? "").join("");
}

/** Non-streaming chat with model fallback. */
export async function chat(system: string, user: string, opts: ChatOpts = {}): Promise<GenerateResult> {
  const body = buildBody(system, user, opts, false);
  let lastErr: LlmError | null = null;

  for (const model of CHAT_MODELS) {
    let res: Response;
    try {
      res = await fetchTimeout(`${BASE}/models/${model}:generateContent`, {
        method: "POST", headers: headers(), body: JSON.stringify(body),
      });
    } catch {
      lastErr = new LlmError(504, `${model} timed out`);   // hung → next model
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as GeminiResponse;
      const text = extractText(data);
      if (!text && data.promptFeedback?.blockReason) {
        throw new LlmError(422, `Blocked by safety filter (${data.promptFeedback.blockReason}).`);
      }
      return {
        text,
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }
    const detail = await errorDetail(res);
    lastErr = new LlmError(res.status, detail);
    if (!RETRYABLE.has(res.status) && res.status !== 404) throw lastErr;   // 400 etc. won't be fixed by another model
  }
  // every Gemini model failed on a retryable error → cross-provider fallback
  if (openaiAvailable()) {
    console.warn("[rag-api] Gemini unavailable, falling back to OpenAI gpt-5-mini:", lastErr?.message);
    return openaiChat(system, user, opts);
  }
  throw lastErr ?? new LlmError(503, "All Gemini models unavailable.");
}

/* ── vision: transcribe/describe an image (Gemini is multimodal) ──
   Used by the ingestion pipeline so images become searchable text. */
export async function extractImageText(mimeType: string, dataBase64: string): Promise<string> {
  const prompt =
    "Transcribe ALL readable text in this image verbatim, preserving reading order. " +
    "If it is a chart, table, diagram, receipt, or a photo with little text, also give a " +
    "concise, factual description of what it shows and any figures or labels present. " +
    "Return plain text only — no preamble.";
  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: dataBase64 } },
      ],
    }],
    generationConfig: { maxOutputTokens: 1200, temperature: 0 },
  };

  let lastErr: LlmError | null = null;
  for (const model of CHAT_MODELS) {
    let res: Response;
    try {
      res = await fetchTimeout(`${BASE}/models/${model}:generateContent`, {
        method: "POST", headers: headers(), body: JSON.stringify(body),
      }, 30_000);
    } catch {
      lastErr = new LlmError(504, `${model} timed out`);
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as GeminiResponse;
      if (!extractText(data) && data.promptFeedback?.blockReason) {
        throw new LlmError(422, `Blocked by safety filter (${data.promptFeedback.blockReason}).`);
      }
      return extractText(data);
    }
    lastErr = new LlmError(res.status, await errorDetail(res));
    if (!RETRYABLE.has(res.status) && res.status !== 404) throw lastErr;
  }
  throw lastErr ?? new LlmError(503, "Image model unavailable.");
}

/* ── streaming (M10): Gemini SSE → the NDJSON frames the client expects ──
   Client contract (unchanged): {"delta":"…"} per chunk, then
   {"done":true,"promptTokens","completionTokens"}, or {"error":"…"}. */

export async function chatStreamResponse(system: string, user: string, opts: ChatOpts = {}): Promise<Response> {
  const body = buildBody(system, user, opts, true);

  let upstream: Response | null = null;
  let lastErr: LlmError | null = null;
  for (const model of CHAT_MODELS) {
    let res: Response;
    try {
      res = await fetchTimeout(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, {
        method: "POST", headers: headers(), body: JSON.stringify(body),
      });
    } catch {
      lastErr = new LlmError(504, `${model} timed out`);
      continue;
    }
    if (res.ok && res.body) { upstream = res; break; }
    lastErr = new LlmError(res.status, await errorDetail(res));
    if (!RETRYABLE.has(res.status) && res.status !== 404) throw lastErr;
  }
  if (!upstream || !upstream.body) {
    if (openaiAvailable()) {
      console.warn("[rag-api] Gemini stream unavailable, falling back to OpenAI gpt-5-mini:", lastErr?.message);
      return openaiChatStream(system, user, opts);
    }
    throw lastErr ?? new LlmError(503, "All Gemini models unavailable.");
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let promptTokens = 0;
  let completionTokens = 0;
  let sse = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode(JSON.stringify({ done: true, promptTokens, completionTokens }) + "\n"));
          controller.close();
          return;
        }
        sse += decoder.decode(value, { stream: true });
        const lines = sse.split("\n");
        sse = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const data = JSON.parse(payload) as GeminiResponse;
            const delta = extractText(data);
            if (delta) controller.enqueue(encoder.encode(JSON.stringify({ delta }) + "\n"));
            if (data.usageMetadata) {
              promptTokens = data.usageMetadata.promptTokenCount ?? promptTokens;
              completionTokens = data.usageMetadata.candidatesTokenCount ?? completionTokens;
            }
          } catch { /* partial SSE frame — buffered lines are complete, ignore */ }
        }
      } catch (e) {
        controller.enqueue(encoder.encode(JSON.stringify({ error: e instanceof Error ? e.message : "stream failed" }) + "\n"));
        controller.close();
      }
    },
    cancel() { void reader.cancel(); },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

/* ── embeddings (gemini-embedding-001, 768-dim, batched) ── */

interface BatchEmbedResponse { embeddings?: { values?: number[] }[] }

export interface EmbedResult { vectors: number[][]; tokens: number }

export async function embedTexts(texts: string[]): Promise<EmbedResult> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const slice = texts.slice(i, i + EMBED_BATCH);
    const res = await fetchTimeout(`${BASE}/models/${EMBED_MODEL}:batchEmbedContents`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({
        requests: slice.map(text => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBED_DIM,
        })),
      }),
    }, 30_000);
    if (!res.ok) throw new LlmError(res.status, await errorDetail(res));
    const data = (await res.json()) as BatchEmbedResponse;
    for (const e of data.embeddings ?? []) {
      const v = e.values ?? [];
      vectors.push(v.map(x => Math.round(x * 1e5) / 1e5));
    }
  }
  // Gemini's embed endpoint doesn't return token usage; estimate for the
  // cost meter (roughly chars/4, the common heuristic).
  const tokens = texts.reduce((n, t) => n + Math.ceil(t.length / 4), 0);
  return { vectors, tokens };
}

export function errorResponse(e: unknown): Response {
  const status = e instanceof LlmError ? e.status : 500;
  const message = e instanceof Error ? e.message : "Unknown server error";
  console.error("[rag-api]", status, message);
  return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
}
