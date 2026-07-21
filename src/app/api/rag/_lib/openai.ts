/* OpenAI gpt-5-mini — the cross-provider CHAT fallback used when every
   Gemini model is unavailable (503/429/timeout). Reads OPENAI_API_KEY
   from the environment (.env.local locally; add it to the host env for
   the fallback to work in production). No key set → fallback is simply
   skipped, and the original Gemini error surfaces. */

const BASE = "https://api.openai.com/v1";
const MODEL = "gpt-5-mini";

export function openaiAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export interface GenerateResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

interface ChatOpts { temperature?: number; maxTokens?: number; jsonMode?: boolean }

interface ChatResponse {
  choices: { message: { content: string | null } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
}

function baseBody(system: string, user: string, opts: ChatOpts): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_completion_tokens: Math.min(Math.max(opts.maxTokens ?? 600, 64), 4000),
    reasoning_effort: "minimal",
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };
  if (opts.temperature !== undefined && opts.temperature !== 1) body.temperature = opts.temperature;
  return body;
}

/** Two-stage param fallback: drop temperature before reasoning_effort so
    "minimal" reasoning (the fast path) survives a temperature rejection. */
async function post(body: Record<string, unknown>): Promise<ChatResponse> {
  const call = () =>
    fetch(`${BASE}/chat/completions`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });

  let res = await call();
  if (res.status === 400 && "temperature" in body) {
    delete body.temperature;
    res = await call();
  }
  if (res.status === 400) {
    delete body.reasoning_effort;
    res = await call();
  }
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json())?.error?.message ?? detail; } catch { /* keep */ }
    throw new Error(`OpenAI fallback failed: ${detail}`);
  }
  return res.json() as Promise<ChatResponse>;
}

export async function openaiChat(system: string, user: string, opts: ChatOpts = {}): Promise<GenerateResult> {
  const data = await post(baseBody(system, user, opts));
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** Streaming fallback → the same NDJSON frames the client expects:
    {"delta":"…"} … {"done":true,"promptTokens","completionTokens"}. */
export async function openaiChatStream(system: string, user: string, opts: ChatOpts = {}): Promise<Response> {
  const body: Record<string, unknown> = {
    ...baseBody(system, user, opts), stream: true, stream_options: { include_usage: true },
  };

  const call = (b: Record<string, unknown>) =>
    fetch(`${BASE}/chat/completions`, { method: "POST", headers: authHeaders(), body: JSON.stringify(b) });

  let upstream = await call(body);
  if (upstream.status === 400 && "temperature" in body) { delete body.temperature; upstream = await call(body); }
  if (upstream.status === 400) { delete body.reasoning_effort; upstream = await call(body); }
  if (!upstream.ok || !upstream.body) {
    let detail = upstream.statusText;
    try { detail = (await upstream.json())?.error?.message ?? detail; } catch { /* keep */ }
    throw new Error(`OpenAI fallback failed: ${detail}`);
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
          const data = line.replace(/^data:\s*/, "").trim();
          if (!data || data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            const delta: string | undefined = j?.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(JSON.stringify({ delta }) + "\n"));
            if (j?.usage) {
              promptTokens = j.usage.prompt_tokens ?? promptTokens;
              completionTokens = j.usage.completion_tokens ?? completionTokens;
            }
          } catch { /* partial frame — ignore */ }
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
