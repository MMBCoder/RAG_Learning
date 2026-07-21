"use client";

import {
  useRagStore, PRICING,
  type StageId, type PromptBlock, type AnswerSentence, type Candidate, type EvalScores,
  type SentenceVerdict,
} from "../ragStore";
import { cleanPages, chunkPages, approxTokens, splitSentences } from "./text";
import { scoreCandidates, projectQuery } from "./retrieval";
import { pca3Async } from "./workers/workerClient";
import { parseByKind, kindFromName, unitLabel } from "./parse";
import { SAMPLE_NAME, SAMPLE_PAGES } from "./sample";
import { withRecording } from "./events";
import { fitContext } from "./contextFit";
import { consumeNdjson } from "./stream";

/* ── plumbing ─────────────────────────────────────────────── */

export class Cancelled extends Error { constructor() { super("cancelled"); } }

/** Play mode (or any observer) can gate each stage. */
export interface StageGate {
  before?: (id: StageId) => Promise<void>;
  after?: (id: StageId) => Promise<void>;
}

const S = () => useRagStore.getState();

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function check(runId: number) {
  if (S().runId !== runId) throw new Cancelled();
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/rag/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && json?.code === "locked") notifyLocked();
  if (!res.ok) throw new Error(json?.error ?? `API error (${res.status})`);
  return json as T;
}

/** The access gate expired or was never satisfied — ask the UI to re-prompt. */
export function notifyLocked(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rag:locked"));
}

async function runStage(
  runId: number,
  id: StageId,
  gate: StageGate | undefined,
  minMs: number,
  work: () => Promise<string | void>,
): Promise<void> {
  check(runId);
  await gate?.before?.(id);
  check(runId);
  S().setStage(id, { status: "running", error: undefined, note: undefined });
  const t0 = performance.now();
  try {
    const note = await work();
    check(runId);
    const elapsed = performance.now() - t0;
    if (elapsed < minMs) await sleep(minMs - elapsed);   // keep the animation legible
    check(runId);
    S().setStage(id, { status: "done", ms: Math.round(performance.now() - t0), note: note ?? undefined });
  } catch (e) {
    if (e instanceof Cancelled) { S().setStage(id, { status: "idle" }); throw e; }
    S().setStage(id, { status: "error", error: e instanceof Error ? e.message : "failed" });
    throw e;
  }
  await gate?.after?.(id);
}

const fmtKB = (bytes: number) => bytes > 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/* ── batched embedding (M6) ───────────────────────────────── */

export const EMBED_BATCH = 100;

/** Embed all chunks in batches of EMBED_BATCH with live progress notes;
    above 300 chunks the note leads with an honest cost preview. */
async function embedAllChunks(myRun: number): Promise<{ vectors: number[][]; tokens: number }> {
  const chunks = S().chunks;
  if (chunks.length > 300) {
    const estTokens = chunks.reduce((n, c) => n + c.tokens, 0);
    S().setStage("embed", {
      status: "running",
      note: `${chunks.length} chunks · est. $${((estTokens * PRICING.embedInput) / 1e6).toFixed(4)}`,
    });
    await sleep(600);   // let the cost preview be READ before numbers stream
  }
  let vectors: number[][] = [];
  let tokens = 0;
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    const res = await api<{ vectors: number[][]; tokens: number }>(
      "embed", { texts: batch.map(c => c.text) },
    );
    check(myRun);
    vectors = vectors.concat(res.vectors);
    tokens += res.tokens;
    if (chunks.length > EMBED_BATCH) {
      S().setStage("embed", { status: "running", note: `${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length} vectors…` });
    }
  }
  return { vectors, tokens };
}

/* ── ingestion ────────────────────────────────────────────── */

export interface IngestSource {
  file?: File;
  bytes?: { data: ArrayBuffer; name: string };   // replay an already-loaded PDF
  sample?: boolean;
}

export async function runIngestion(source: IngestSource, rawGate?: StageGate): Promise<boolean> {
  S().resetAll();                    // also bumps runId, cancelling any in-flight run
  const myRun = S().runId;
  const gate = withRecording(rawGate, "ingestion");   // every run records events (F2)

  try {
    /* 1 · upload */
    await runStage(myRun, "upload", gate, 500, async () => {
      if (source.file) {
        const f = source.file;
        const kind = kindFromName(f.name);
        if (!kind) throw new Error("Unsupported file type. Use PDF, Word, Excel, Markdown, text, or an image.");
        if (f.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB.");
        const bytes = await f.arrayBuffer();
        S().patch({ docName: f.name, docBytes: f.size, isSample: false, docKind: kind, pdfData: bytes });
        return `${f.name} · ${fmtKB(f.size)}`;
      }
      if (source.bytes) {
        S().patch({
          docName: source.bytes.name, docBytes: source.bytes.data.byteLength,
          isSample: false, docKind: kindFromName(source.bytes.name), pdfData: source.bytes.data,
        });
        return `${source.bytes.name} · ${fmtKB(source.bytes.data.byteLength)}`;
      }
      const bytes = SAMPLE_PAGES.reduce((n, p) => n + p.text.length, 0);
      S().patch({ docName: SAMPLE_NAME, docBytes: bytes, isSample: true, docKind: "sample", pdfData: null });
      return `sample guide · ${fmtKB(bytes)}`;
    });

    /* 2 · parse */
    await runStage(myRun, "parse", gate, 600, async () => {
      const st = S();
      if (st.isSample) {
        S().patch({ pages: SAMPLE_PAGES });
        return `${SAMPLE_PAGES.length} pages`;
      }
      const pages = await parseByKind(st.docKind, st.pdfData!, st.docName ?? "");
      const chars = pages.reduce((n, p) => n + p.text.length, 0);
      if (chars < 20) {
        throw new Error(st.docKind === "pdf"
          ? "No selectable text found — this PDF looks like a scan."
          : "No usable text could be extracted from this file.");
      }
      S().patch({ pages });
      return `${pages.length} ${unitLabel(st.docKind, pages.length)} · ${chars.toLocaleString()} chars`;
    });

    /* 3 · clean */
    await runStage(myRun, "clean", gate, 500, async () => {
      const { pages, stats } = cleanPages(S().pages);
      S().patch({ cleanedPages: pages, cleanStats: stats });
      const removed = stats.before - stats.after;
      return `${stats.joinedLines} lines joined · ${removed >= 0 ? removed : 0} chars removed`;
    });

    /* 4 · chunk */
    await runStage(myRun, "chunk", gate, 600, async () => {
      const st = S();
      const chunks = chunkPages(st.cleanedPages, st.params.chunkSize, st.params.chunkOverlap);
      if (chunks.length === 0) throw new Error("Chunking produced no chunks.");
      S().patch({ chunks, chunksStale: false });
      return `${chunks.length} chunks · ~${Math.round(chunks.reduce((n, c) => n + c.chars, 0) / chunks.length)} chars avg`;
    });

    /* 5 · tokenize */
    await runStage(myRun, "tokenize", gate, 500, async () => {
      const total = S().chunks.reduce((n, c) => n + c.tokens, 0);
      return `≈ ${total.toLocaleString()} tokens (est.)`;
    });

    /* 6 · embed — batched calls, PCA off the main thread (M6) */
    await runStage(myRun, "embed", gate, 400, async () => {
      const { vectors, tokens } = await embedAllChunks(myRun);
      check(myRun);
      const coords3 = await pca3Async(vectors);
      check(myRun);
      S().patch({ embeddings: vectors, coords3 });
      S().addUsage({ embedTokens: tokens, costUSD: (tokens * PRICING.embedInput) / 1e6 });
      return `${vectors.length} × ${vectors[0]?.length ?? 0} dims`;
    });

    /* 7 · index */
    await runStage(myRun, "index", gate, 900, async () => {
      S().patch({ ingested: true });
      return `${S().embeddings.length} vectors indexed`;
    });

    return true;
  } catch (e) {
    if (e instanceof Cancelled) return false;
    console.error("[rag] ingestion failed:", e);
    return false;
  }
}

/* ── query ────────────────────────────────────────────────── */

export const RERANK_POOL_EXTRA = 4;

export async function runQuery(question: string, rawGate?: StageGate): Promise<boolean> {
  const store = S();
  if (!store.ingested || store.chunks.length === 0) return false;
  const runId = store.bumpRun();
  store.resetQuery();
  store.patch({ query: question });
  const gate = withRecording(rawGate, "query");   // every run records events (F2)

  try {
    /* 8 · query embedding */
    await runStage(runId, "query", gate, 400, async () => {
      const { vectors, tokens } = await api<{ vectors: number[][]; tokens: number }>(
        "embed", { texts: [question] },
      );
      check(runId);
      S().patch({ queryVec: vectors[0] });
      S().addUsage({ embedTokens: tokens, costUSD: (tokens * PRICING.embedInput) / 1e6 });
      return `1 × ${vectors[0].length} dims`;
    });

    /* 9 · retrieve */
    await runStage(runId, "retrieve", gate, 700, async () => {
      const st = S();
      const cands = scoreCandidates(st.queryVec!, question, st.chunks, st.embeddings, st.params.hybridAlpha);
      const surviving = cands.filter(c => c.hybrid >= st.params.threshold).slice(0, st.params.topK);
      S().patch({ candidates: cands, results: surviving.map(c => c.chunkId) });
      return `${surviving.length} of ${cands.length} chunks pass`;
    });

    /* 10 · rerank */
    await runStage(runId, "rerank", gate, 400, async () => {
      const st = S();
      if (!st.params.useRerank) return "skipped (disabled)";
      const pool = st.candidates
        .filter(c => c.hybrid >= st.params.threshold)
        .slice(0, Math.min(st.params.topK + RERANK_POOL_EXTRA, 12));
      if (pool.length < 2) return "skipped (too few candidates)";

      const byId = new Map(st.chunks.map(c => [c.id, c]));
      const { scores, promptTokens, completionTokens } = await api<{
        scores: { id: number; score: number }[]; promptTokens: number; completionTokens: number;
      }>("rerank", {
        query: question,
        candidates: pool.map(c => ({ id: c.chunkId, text: byId.get(c.chunkId)!.text })),
      });
      check(runId);
      S().addUsage({
        promptTokens, completionTokens,
        costUSD: (promptTokens * PRICING.genInput + completionTokens * PRICING.genOutput) / 1e6,
      });
      if (scores.length === 0) return "model output unusable — kept hybrid order";

      const scoreMap = new Map(scores.map(s => [s.id, s.score]));
      const cands: Candidate[] = S().candidates.map(c => ({ ...c, rerankScore: scoreMap.get(c.chunkId), rerankRank: undefined }));
      const reranked = pool
        .map(c => ({ id: c.chunkId, score: scoreMap.get(c.chunkId) ?? 0 }))
        .sort((a, b) => b.score - a.score);
      reranked.forEach((r, i) => {
        const cand = cands.find(c => c.chunkId === r.id);
        if (cand) cand.rerankRank = i + 1;
      });
      const results = reranked.slice(0, S().params.topK).map(r => r.id);
      S().patch({ candidates: cands, results });
      const moved = reranked.filter((r, i) => pool[i]?.chunkId !== r.id).length;
      return `${pool.length} rescored · ${moved} moved`;
    });

    /* 11 · prompt — packing via the shared fit function (vessel = prompt truth, M8) */
    await runStage(runId, "prompt", gate, 600, async () => {
      const st = S();
      const byId = new Map(st.chunks.map(c => [c.id, c]));
      const { kept, ctxTokens } = fitContext(st.results, st.chunks, st.params.contextBudget);
      const context = kept.map(id => `[${id}] ${byId.get(id)!.text}`).join("\n\n");
      const questionBlock = `Question: ${question}\n\nAnswer using ONLY the context above. Cite chunk numbers like [3] after each claim.`;

      const blocks: PromptBlock[] = [
        { label: "System Prompt", text: st.params.systemPrompt, tokens: approxTokens(st.params.systemPrompt), color: "#8B5CF6" },
        { label: "Retrieved Context", text: context, tokens: ctxTokens, color: "#2563EB" },
        { label: "User Question", text: questionBlock, tokens: approxTokens(questionBlock), color: "#059669" },
      ];
      S().patch({ promptBlocks: blocks, results: kept });
      return `${blocks.reduce((n, b) => n + b.tokens, 0)} tokens · ${kept.length} chunks in context`;
    });

    /* 12 · generate — streaming (M10): the answer builds incrementally in
       the store; the non-stream JSON path stays as automatic fallback */
    await runStage(runId, "generate", gate, 400, async () => {
      const st = S();
      const [sys, ctx, q] = st.promptBlocks;
      const payload = {
        system: sys.text,
        user: `Context:\n${ctx.text}\n\n${q.text}`,
        temperature: st.params.temperature,
        maxTokens: st.params.maxTokens,
      };
      const res = await fetch("/api/rag/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: true }),
      });
      check(runId);

      let text = "", promptTokens = 0, completionTokens = 0;
      if (res.ok && res.body && res.headers.get("content-type")?.includes("ndjson")) {
        useRagStore.setState({ brainStats: { startedAt: performance.now(), firstTokenAt: null, lastDeltaAt: null, deltas: 0 } });
        try {
          const totals = await consumeNdjson(res, acc => {
            if (S().runId !== runId) return;   // cancelled — stop touching the store
            const bs = useRagStore.getState().brainStats;
            if (bs) {
              const now = performance.now();
              useRagStore.setState({
                brainStats: { ...bs, firstTokenAt: bs.firstTokenAt ?? now, lastDeltaAt: now, deltas: bs.deltas + 1 },
              });
            }
            S().patch({ answer: acc });
          });
          text = totals.text;
          promptTokens = totals.promptTokens;
          completionTokens = totals.completionTokens;
        } catch (e) {
          // a partial answer from a broken stream is discarded cleanly
          if (S().runId === runId) S().patch({ answer: null });
          throw e;
        }
      } else {
        const json = await res.json().catch(() => ({}));
        if (res.status === 401 && json?.code === "locked") notifyLocked();
        if (!res.ok) throw new Error(json?.error ?? `API error (${res.status})`);
        ({ text, promptTokens, completionTokens } = json as { text: string; promptTokens: number; completionTokens: number });
      }
      check(runId);
      if (!text.trim()) throw new Error("Model returned an empty answer.");
      S().patch({ answer: text });
      S().addUsage({
        promptTokens, completionTokens,
        costUSD: (promptTokens * PRICING.genInput + completionTokens * PRICING.genOutput) / 1e6,
      });
      return `${completionTokens} tokens out`;
    });

    /* 13 · grounding */
    await runStage(runId, "ground", gate, 600, async () => {
      const st = S();
      const valid = new Set(st.chunks.map(c => c.id));
      const sentences: AnswerSentence[] = splitSentences(st.answer!.replace(/\n+/g, " ")).map(s => ({
        text: s,
        citations: [...new Set([...s.matchAll(/\[(\d+)\]/g)]
          .map(m => Number(m[1]))
          .filter(id => valid.has(id)))],
      }));
      S().patch({ answerSentences: sentences });
      const cited = sentences.filter(s => s.citations.length > 0).length;
      return `${cited}/${sentences.length} sentences cite sources`;
    });

    /* 14 · evaluate — doc scores + per-sentence verdicts (M9) */
    await runStage(runId, "evaluate", gate, 400, async () => {
      const st = S();
      const ctx = st.promptBlocks[1]?.text ?? "";
      const { scores, sentenceVerdicts, promptTokens, completionTokens } = await api<{
        scores: EvalScores; sentenceVerdicts: SentenceVerdict[] | null;
        promptTokens: number; completionTokens: number;
      }>("evaluate", {
        question, context: ctx, answer: st.answer,
        sentences: st.answerSentences.slice(0, 25).map(s => s.text),
      });
      check(runId);
      // verdict arrays that don't align with sentences degrade to doc-level
      const aligned = sentenceVerdicts && sentenceVerdicts.length === Math.min(st.answerSentences.length, 25)
        ? sentenceVerdicts : null;
      S().patch({ evalScores: scores, sentenceVerdicts: aligned });
      S().addUsage({
        promptTokens, completionTokens,
        costUSD: (promptTokens * PRICING.genInput + completionTokens * PRICING.genOutput) / 1e6,
      });
      return `faithfulness ${scores.faithfulness} · risk ${scores.hallucinationRisk}`;
    });

    return true;
  } catch (e) {
    if (e instanceof Cancelled) return false;
    console.error("[rag] query failed:", e);
    return false;
  }
}

/* ── instant param feedback (no API calls) ────────────────── */

/** Re-chunk locally after chunk-size/overlap changes; embeddings become stale. */
export function rechunkLocal(): void {
  const st = S();
  if (st.cleanedPages.length === 0) return;
  const chunks = chunkPages(st.cleanedPages, st.params.chunkSize, st.params.chunkOverlap);
  st.patch({
    chunks, chunksStale: true, ingested: false,
    embeddings: [], coords3: [], candidates: [], results: [],
  });
  st.setStage("chunk", { status: "done", note: `${chunks.length} chunks · re-chunked` });
  st.setStage("tokenize", { status: "done", note: `≈ ${chunks.reduce((n, c) => n + c.tokens, 0).toLocaleString()} tokens (est.)` });
  (["embed", "index", "query", "retrieve", "rerank", "prompt", "generate", "ground", "evaluate"] as StageId[])
    .forEach(id => st.setStage(id, { status: "stale", note: "re-embed required" }));
}

/** Re-embed after a local re-chunk, without re-parsing the document. */
export async function reembed(): Promise<boolean> {
  const st = S();
  if (st.chunks.length === 0) return false;
  const runId = st.bumpRun();
  const gate = withRecording(undefined, "reembed");
  try {
    await runStage(runId, "embed", gate, 400, async () => {
      const { vectors, tokens } = await embedAllChunks(runId);
      check(runId);
      const coords3 = await pca3Async(vectors);
      check(runId);
      S().patch({ embeddings: vectors, coords3, chunksStale: false });
      S().addUsage({ embedTokens: tokens, costUSD: (tokens * PRICING.embedInput) / 1e6 });
      return `${vectors.length} × ${vectors[0]?.length ?? 0} dims`;
    });
    await runStage(runId, "index", gate, 700, async () => {
      S().patch({ ingested: true });
      return `${S().embeddings.length} vectors indexed`;
    });
    (["query", "retrieve", "rerank", "prompt", "generate", "ground", "evaluate"] as StageId[])
      .forEach(id => S().setStage(id, { status: "idle", note: undefined }));
    return true;
  } catch (e) {
    if (!(e instanceof Cancelled)) console.error("[rag] re-embed failed:", e);
    return false;
  }
}

/** Instantly re-score retrieval when topK / alpha / threshold change. */
export function rescoreLocal(): void {
  const st = S();
  if (!st.queryVec || st.chunks.length === 0) return;
  const cands = scoreCandidates(st.queryVec, st.query, st.chunks, st.embeddings, st.params.hybridAlpha);
  const surviving = cands.filter(c => c.hybrid >= st.params.threshold).slice(0, st.params.topK);
  st.patch({ candidates: cands, results: surviving.map(c => c.chunkId) });
  st.setStage("retrieve", { status: "done", note: `${surviving.length} of ${cands.length} chunks pass · re-scored` });
  (["rerank", "prompt", "generate", "ground", "evaluate"] as StageId[])
    .forEach(id => st.setStage(id, { status: "stale", note: "ask again to refresh" }));
}

/** 3D position of the current query in the embedding space view. */
export function queryCoord(): [number, number, number] | null {
  const st = S();
  if (!st.queryVec || st.coords3.length === 0) return null;
  return projectQuery(st.queryVec, st.embeddings, st.coords3);
}

export function cancelRun(): void {
  S().bumpRun();
  // settle any running stages back to idle
  const st = S();
  (Object.keys(st.stages) as StageId[]).forEach(id => {
    if (st.stages[id].status === "running") st.setStage(id, { status: "idle" });
  });
}
