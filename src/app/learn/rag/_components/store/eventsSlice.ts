import type { StateCreator } from "zustand";
import type { PipelineSlice } from "./pipelineSlice";
import type {
  StageId, StageState, PageText, Chunk, Candidate, PromptBlock,
  AnswerSentence, EvalScores, SentenceVerdict, Usage,
} from "./types";

/* Event sourcing (architecture F2): every run appends immutable events.
   Snapshots are BY REFERENCE — V1's store discipline is replacement-not-
   mutation, so a snapshot is a bag of pointers to the artifacts as they
   existed at that moment. Cost: pointers, not copies; memory stays flat
   across successive runs. */

export interface ArtifactRefs {
  docName: string | null;
  docBytes: number;
  isSample: boolean;
  pages: PageText[];
  cleanStats: PipelineSlice["cleanStats"];
  cleanedPages: PageText[];
  chunks: Chunk[];
  embeddings: number[][];
  coords3: [number, number, number][];
  query: string;
  queryVec: number[] | null;
  candidates: Candidate[];
  results: number[];
  promptBlocks: PromptBlock[];
  answer: string | null;
  answerSentences: AnswerSentence[];
  evalScores: EvalScores | null;
  sentenceVerdicts: SentenceVerdict[] | null;
  stages: Record<StageId, StageState>;
  usage: Usage;
  ingested: boolean;
}

/** Pointers, not copies — the whole trick. */
export function captureSnapshot(s: PipelineSlice): ArtifactRefs {
  return {
    docName: s.docName, docBytes: s.docBytes, isSample: s.isSample,
    pages: s.pages, cleanStats: s.cleanStats, cleanedPages: s.cleanedPages,
    chunks: s.chunks, embeddings: s.embeddings, coords3: s.coords3,
    query: s.query, queryVec: s.queryVec, candidates: s.candidates,
    results: s.results, promptBlocks: s.promptBlocks, answer: s.answer,
    answerSentences: s.answerSentences, evalScores: s.evalScores,
    sentenceVerdicts: s.sentenceVerdicts,
    stages: s.stages, usage: s.usage, ingested: s.ingested,
  };
}

export type RunKind = "ingestion" | "query" | "reembed";

export interface PipelineEvent {
  seq: number;              // dense, ascending — index into the log
  t: number;                // performance.now() at capture
  runId: number;
  kind: "run-start" | "stage-done";
  runKind: RunKind;
  stage: StageId | null;    // null for run-start
  ms?: number;              // measured stage duration
  note?: string;
  snapshot: ArtifactRefs;
}

export interface EventsSlice {
  events: PipelineEvent[];
  /** null = live view; a seq = "show the world as of this event" */
  scrubSeq: number | null;

  recordEvent: (e: Omit<PipelineEvent, "seq">) => void;
  clearEvents: () => void;
  setScrub: (seq: number | null) => void;
}

export const createEventsSlice: StateCreator<EventsSlice, [], [], EventsSlice> = (set, get) => ({
  events: [],
  scrubSeq: null,

  recordEvent: (e) => {
    const events = get().events;
    set({ events: [...events, { ...e, seq: events.length }] });
  },

  clearEvents: () => set({ events: [], scrubSeq: null }),

  setScrub: (seq) => set({ scrubSeq: seq }),
});
