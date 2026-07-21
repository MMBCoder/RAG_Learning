import type { StateCreator } from "zustand";
import {
  STAGE_IDS, DEFAULT_PARAMS,
  type StageId, type StageState, type StageStatus, type PageText, type Chunk,
  type Candidate, type PromptBlock, type AnswerSentence, type EvalScores,
  type SentenceVerdict, type RagParams, type Usage, type PlayState, type DocKind,
} from "./types";

/* The V1 pipeline slice — state shape and actions moved verbatim from
   ragStore.ts in M0. Future slices (events, history, ui, compare, coach)
   compose alongside this one; the combined store type lives in ragStore.ts. */

export interface PipelineSlice {
  /* document artifacts */
  docName: string | null;
  docBytes: number;
  isSample: boolean;
  docKind: DocKind;                // pdf | word | excel | markdown | text | image | sample
  pdfData: ArrayBuffer | null;     // raw bytes of the upload (preview + re-parse on replay)
  pages: PageText[];
  cleanStats: { before: number; after: number; joinedLines: number; fixedHyphens: number } | null;
  cleanedPages: PageText[];
  chunks: Chunk[];
  embeddings: number[][];          // parallel to chunks
  coords3: [number, number, number][]; // PCA projection, parallel to chunks

  /* query artifacts */
  query: string;
  queryVec: number[] | null;
  candidates: Candidate[];         // all chunks scored, sorted by hybrid
  results: number[];               // chunkIds actually sent to the LLM (post rerank/threshold/topK)
  promptBlocks: PromptBlock[];
  answer: string | null;
  answerSentences: AnswerSentence[];
  evalScores: EvalScores | null;
  /** per-sentence judge verdicts, parallel to answerSentences (M9); null = judge gave doc-level only */
  sentenceVerdicts: SentenceVerdict[] | null;

  /* bookkeeping */
  stages: Record<StageId, StageState>;
  params: RagParams;
  usage: Usage;
  runId: number;                   // bumped to cancel in-flight runs
  ingested: boolean;               // pipeline ready for questions
  chunksStale: boolean;            // chunk params changed after embedding

  /* ui */
  selected: StageId | null;
  hoverChunk: number | null;       // chunkId hovered anywhere (grounding sync)
  inspectorChunk: number | null;   // chunk pinned in tokenize view
  play: PlayState;

  /* actions */
  setStage: (id: StageId, patch: Partial<StageState>) => void;
  resetStagesFrom: (id: StageId) => void;
  setParam: <K extends keyof RagParams>(key: K, value: RagParams[K]) => void;
  select: (id: StageId | null) => void;
  setHoverChunk: (id: number | null) => void;
  patch: (p: Partial<PipelineSlice>) => void;
  addUsage: (u: Partial<Usage>) => void;
  bumpRun: () => number;
  resetAll: () => void;
  resetQuery: () => void;
}

const idleStages = (): Record<StageId, StageState> =>
  Object.fromEntries(STAGE_IDS.map(id => [id, { status: "idle" as StageStatus }])) as Record<StageId, StageState>;

const initialData = {
  docName: null, docBytes: 0, isSample: false, docKind: null as DocKind, pdfData: null,
  pages: [], cleanStats: null, cleanedPages: [], chunks: [],
  embeddings: [], coords3: [],
  query: "", queryVec: null, candidates: [], results: [],
  promptBlocks: [], answer: null, answerSentences: [], evalScores: null,
  sentenceVerdicts: null as SentenceVerdict[] | null,
  stages: idleStages(),
  usage: { embedTokens: 0, promptTokens: 0, completionTokens: 0, costUSD: 0 },
  ingested: false, chunksStale: false,
  selected: null as StageId | null, hoverChunk: null, inspectorChunk: null,
};

export const createPipelineSlice: StateCreator<PipelineSlice, [], [], PipelineSlice> = (set, get) => ({
  ...initialData,
  params: { ...DEFAULT_PARAMS },
  runId: 0,
  play: { active: false, paused: false, step: 0, totalSteps: 0, speed: 1, stepMode: false, narration: "" },

  setStage: (id, patch) =>
    set(s => ({ stages: { ...s.stages, [id]: { ...s.stages[id], ...patch } } })),

  resetStagesFrom: (id) => {
    const idx = STAGE_IDS.indexOf(id);
    set(s => {
      const stages = { ...s.stages };
      STAGE_IDS.slice(idx).forEach(sid => { stages[sid] = { status: "idle" }; });
      return { stages };
    });
  },

  setParam: (key, value) => set(s => ({ params: { ...s.params, [key]: value } })),
  select: (id) => set({ selected: id }),
  setHoverChunk: (id) => set({ hoverChunk: id }),
  patch: (p) => set(p),

  addUsage: (u) => set(s => ({
    usage: {
      embedTokens: s.usage.embedTokens + (u.embedTokens ?? 0),
      promptTokens: s.usage.promptTokens + (u.promptTokens ?? 0),
      completionTokens: s.usage.completionTokens + (u.completionTokens ?? 0),
      costUSD: s.usage.costUSD + (u.costUSD ?? 0),
    },
  })),

  bumpRun: () => { const id = get().runId + 1; set({ runId: id }); return id; },

  resetAll: () => set({ ...initialData, stages: idleStages(), runId: get().runId + 1 }),

  resetQuery: () => set(s => {
    const stages = { ...s.stages };
    (["query", "retrieve", "rerank", "prompt", "generate", "ground", "evaluate"] as StageId[])
      .forEach(id => { stages[id] = { status: "idle" }; });
    return {
      stages, queryVec: null, candidates: [], results: [],
      promptBlocks: [], answer: null, answerSentences: [], evalScores: null,
      sentenceVerdicts: null,
    };
  }),
});
