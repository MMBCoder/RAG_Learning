import type { RagStore } from "../ragStore";
import type { StageId } from "./types";

/* Live artifact serialisation for the engineer persona's raw-data tab.
   REAL pipeline data only — large arrays are truncated for display and
   every truncation says so explicitly (honesty rule). */

const trim = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);
const round5 = (x: number) => Math.round(x * 1e5) / 1e5;

export function stageArtifact(s: RagStore, id: StageId): Record<string, unknown> {
  switch (id) {
    case "upload":
      return { docName: s.docName, docBytes: s.docBytes, isSample: s.isSample };
    case "parse":
      return {
        pages: s.pages.length,
        totalChars: s.pages.reduce((n, p) => n + p.text.length, 0),
        preview: s.pages.slice(0, 2).map(p => ({ page: p.page, text: trim(p.text, 160) })),
        ...(s.pages.length > 2 ? { note: `preview shows first 2 of ${s.pages.length} pages` } : {}),
      };
    case "clean":
      return {
        stats: s.cleanStats,
        preview: s.cleanedPages.slice(0, 1).map(p => ({ page: p.page, text: trim(p.text, 200) })),
      };
    case "chunk":
      return {
        count: s.chunks.length,
        avgChars: s.chunks.length
          ? Math.round(s.chunks.reduce((n, c) => n + c.chars, 0) / s.chunks.length) : 0,
        chunks: s.chunks.slice(0, 20).map(c => ({
          id: c.id, page: c.page, start: c.start, chars: c.chars,
          tokens: c.tokens, overlapChars: c.overlapChars, text: trim(c.text, 90),
        })),
        ...(s.chunks.length > 20 ? { note: `first 20 of ${s.chunks.length} chunks shown` } : {}),
      };
    case "tokenize":
      return {
        estimatedTokens: s.chunks.reduce((n, c) => n + c.tokens, 0),
        estimator: "cl100k-style approximation (0.45·words + 0.55·chars/4)",
        perChunk: s.chunks.slice(0, 20).map(c => ({ id: c.id, tokens: c.tokens })),
        ...(s.chunks.length > 20 ? { note: `first 20 of ${s.chunks.length} chunks shown` } : {}),
      };
    case "embed":
      return {
        vectors: s.embeddings.length,
        dims: s.embeddings[0]?.length ?? 0,
        model: "gemini-embedding-001",
        sampleVector: (s.embeddings[0] ?? []).slice(0, 8).map(round5),
        ...(s.embeddings[0] ? { note: `sample shows first 8 of ${s.embeddings[0].length} dims of chunk 1` } : {}),
      };
    case "index":
      return { indexedVectors: s.embeddings.length, ingested: s.ingested, backend: "in-memory cosine scan" };
    case "query":
      return {
        query: s.query,
        dims: s.queryVec?.length ?? 0,
        sampleVector: (s.queryVec ?? []).slice(0, 8).map(round5),
        ...(s.queryVec ? { note: `sample shows first 8 of ${s.queryVec.length} dims` } : {}),
      };
    case "retrieve":
      return {
        params: { topK: s.params.topK, threshold: s.params.threshold, hybridAlpha: s.params.hybridAlpha },
        results: s.results,
        candidates: s.candidates.slice(0, 12).map(c => ({
          chunkId: c.chunkId, semantic: round5(c.semantic),
          keyword: round5(c.keyword), hybrid: round5(c.hybrid), rank: c.rank,
        })),
        ...(s.candidates.length > 12 ? { note: `first 12 of ${s.candidates.length} candidates shown` } : {}),
      };
    case "rerank":
      return {
        enabled: s.params.useRerank,
        rescored: s.candidates
          .filter(c => c.rerankScore !== undefined)
          .map(c => ({ chunkId: c.chunkId, hybridRank: c.rank, rerankScore: c.rerankScore, rerankRank: c.rerankRank })),
        finalResults: s.results,
      };
    case "prompt":
      return {
        totalTokens: s.promptBlocks.reduce((n, b) => n + b.tokens, 0),
        blocks: s.promptBlocks.map(b => ({ label: b.label, tokens: b.tokens, text: trim(b.text, 220) })),
      };
    case "generate":
      return { model: "gemini-flash-latest", answer: s.answer, usage: s.usage };
    case "ground":
      return {
        sentences: s.answerSentences.map(a => ({ text: trim(a.text, 90), citations: a.citations })),
        citedSentences: s.answerSentences.filter(a => a.citations.length > 0).length,
      };
    case "evaluate":
      return { judge: "gemini-flash-latest (LLM-as-judge — a judgment, not ground truth)", scores: s.evalScores };
  }
}
