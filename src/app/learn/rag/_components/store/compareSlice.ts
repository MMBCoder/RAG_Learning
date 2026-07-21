import type { StateCreator } from "zustand";
import type { PipelineSlice } from "./pipelineSlice";
import type { RagParams, EvalScores, Usage } from "./types";
import type { ExperimentId } from "../education/concepts";

/* Compare slice (M12): snapshot-based A/B. Pinning captures the CURRENT
   run as configuration A by value (params copied; artifacts by ref);
   the live store keeps evolving as B. Lab experiments and the journey's
   chapters 6–7 read their completion flags from here. */

export interface RunPin {
  at: number;
  runId: number;
  params: RagParams;
  query: string;
  results: number[];
  evalScores: EvalScores | null;
  answer: string | null;
  usageAt: Usage;              // session usage at pin time → B's delta is real
  queryMs: number;             // measured question→answer time
  chunkCount: number;
}

export interface CompareSlice {
  pinnedA: RunPin | null;
  /** hypothesis text captured when a lab experiment starts (prediction first) */
  labActive: { id: ExperimentId; hypothesis: string } | null;
  labRuns: number;             // completed lab experiments (journey ch. 6)
  comparedRuns: number;        // completed A/B comparisons viewed (journey ch. 7)

  pinA: () => void;
  clearPin: () => void;
  setLabActive: (v: CompareSlice["labActive"]) => void;
  markLabRun: () => void;
  markCompared: () => void;
}

const QUERY_STAGES = ["query", "retrieve", "rerank", "prompt", "generate", "ground", "evaluate"] as const;

export const createCompareSlice: StateCreator<
  CompareSlice & PipelineSlice, [], [], CompareSlice
> = (set, get) => ({
  pinnedA: null,
  labActive: null,
  labRuns: 0,
  comparedRuns: 0,

  pinA: () => {
    const s = get();
    if (!s.answer) return;   // nothing to pin without a completed run
    set({
      pinnedA: {
        at: Date.now(),
        runId: s.runId,
        params: { ...s.params },
        query: s.query,
        results: [...s.results],
        evalScores: s.evalScores,
        answer: s.answer,
        usageAt: { ...s.usage },
        queryMs: QUERY_STAGES.reduce((n, id) => n + (s.stages[id].ms ?? 0), 0),
        chunkCount: s.chunks.length,
      },
    });
  },

  clearPin: () => set({ pinnedA: null }),
  setLabActive: (v) => set({ labActive: v }),
  markLabRun: () => set({ labRuns: get().labRuns + 1, labActive: null }),
  markCompared: () => set({ comparedRuns: get().comparedRuns + 1 }),
});
