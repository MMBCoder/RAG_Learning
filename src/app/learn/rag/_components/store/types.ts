/* Domain types and constants for the RAG pipeline store.
   Moved verbatim from ragStore.ts in M0 — ragStore re-exports everything,
   so `import { … } from "./ragStore"` keeps working unchanged. */

export type StageId =
  | "upload" | "parse" | "clean" | "chunk" | "tokenize" | "embed" | "index"
  | "query" | "retrieve" | "rerank" | "prompt" | "generate" | "ground" | "evaluate";

export type StageStatus = "idle" | "running" | "done" | "error" | "stale";

export interface StageState {
  status: StageStatus;
  ms?: number;          // processing time
  note?: string;        // one-line result summary shown on the node
  error?: string;
}

export interface PageText { page: number; text: string; }

/** Which kind of source document was ingested — drives parsing and preview. */
export type DocKind = "pdf" | "word" | "excel" | "markdown" | "text" | "image" | "sample" | null;

export interface Chunk {
  id: number;
  text: string;
  page: number;         // page the chunk starts on
  start: number;        // char offset in cleaned doc
  chars: number;
  tokens: number;       // approximate
  overlapChars: number; // chars carried from previous chunk
}

export interface Candidate {
  chunkId: number;
  semantic: number;     // cosine similarity 0..1
  keyword: number;      // normalised BM25 0..1
  hybrid: number;       // blended score 0..1
  rank: number;         // rank by hybrid (1-based)
  rerankScore?: number; // LLM re-rank score 0..100
  rerankRank?: number;
}

export interface PromptBlock {
  label: "System Prompt" | "Retrieved Context" | "User Question";
  text: string;
  tokens: number;
  color: string;
}

export interface AnswerSentence { text: string; citations: number[]; }

/* Per-sentence judge verdicts (M9). Mirrors the evaluate route's schema;
   verdicts are LLM judgments, not ground truth — every consumer labels
   them as such. */
export type SupportLevel = "supported" | "partial" | "unsupported";

export interface SentenceVerdict {
  support: SupportLevel;
  evidence: number[];   // chunk ids the judge points at
}

export interface EvalScores {
  faithfulness: number;
  answerRelevance: number;
  contextPrecision: number;
  contextRecall: number;
  hallucinationRisk: number;
  verdict: string;
}

export interface RagParams {
  chunkSize: number;       // target chars per chunk
  chunkOverlap: number;    // chars
  topK: number;
  threshold: number;       // min hybrid score 0..1
  hybridAlpha: number;     // 1 = pure semantic, 0 = pure keyword
  useRerank: boolean;
  temperature: number;
  maxTokens: number;
  contextBudget: number;   // token budget for retrieved context
  systemPrompt: string;
}

export interface Usage {
  embedTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUSD: number;
}

export interface PlayState {
  active: boolean;
  paused: boolean;
  step: number;          // index into the play script
  totalSteps: number;
  speed: 0.5 | 1 | 2;
  stepMode: boolean;
  narration: string;
  /** true once the run finished and the finale summary is on screen (M5) */
  finale?: boolean;
}

/* ────────────────────────── defaults ────────────────────────── */

export const DEFAULT_SYSTEM_PROMPT =
  `You are a precise assistant that answers ONLY from the provided context.
Cite every claim with the chunk number in square brackets, e.g. [2].
If the context does not contain the answer, say so plainly. Never invent facts.`;

export const DEFAULT_PARAMS: RagParams = {
  chunkSize: 600,
  chunkOverlap: 80,
  topK: 4,
  threshold: 0.25,
  hybridAlpha: 0.7,
  useRerank: true,
  temperature: 1,
  maxTokens: 600,
  contextBudget: 2000,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

export const STAGE_IDS: StageId[] = [
  "upload", "parse", "clean", "chunk", "tokenize", "embed", "index",
  "query", "retrieve", "rerank", "prompt", "generate", "ground", "evaluate",
];

/* pricing estimates (USD per 1M tokens) — displayed as estimates in the UI.
   Google Gemini flash-lite list prices; the deployed key runs the free
   tier ($0 in practice), so these are "at paid scale" estimates. */
export const PRICING = {
  embedInput: 0.15,          // gemini-embedding-001
  genInput: 0.10,            // gemini flash-lite input
  genOutput: 0.40,           // gemini flash-lite output
};
