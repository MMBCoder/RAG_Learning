"use client";

import { useEffect, useRef } from "react";
import { useRagStore, type RagStore } from "../ragStore";
import type { ConceptId } from "./concepts";

/* Learning Moments (architecture §A3): real pipeline data crossing a
   teachable threshold becomes a micro-lesson at the moment of maximum
   curiosity. Rules are pure functions over store state — unit-testable,
   and incapable of inventing numbers. */

/** The narrow slice of state the rules read (kept small for testability). */
export type MomentState = Pick<
  RagStore,
  "stages" | "candidates" | "results" | "params" | "promptBlocks" | "evalScores" | "chunks"
>;

export interface MomentRule {
  id: string;
  conceptId: ConceptId;
  evaluate: (s: MomentState) => string | null;
}

export const MOMENT_RULES: MomentRule[] = [
  {
    id: "empty-retrieval",
    conceptId: "similarity-threshold",
    evaluate: s => {
      if (s.stages.retrieve.status !== "done" || s.results.length > 0 || s.candidates.length === 0) return null;
      return `Retrieval came back empty — all ${s.candidates.length} chunks scored below your similarity threshold (${s.params.threshold.toFixed(2)}). That's the threshold being honest: better no evidence than bad evidence. Lower it, or ask something closer to the document.`;
    },
  },
  {
    id: "threshold-rejections",
    conceptId: "similarity-threshold",
    evaluate: s => {
      if (s.stages.retrieve.status !== "done" || s.results.length === 0) return null;
      const passed = s.candidates.filter(c => c.hybrid >= s.params.threshold).length;
      const rejected = s.candidates.length - passed;
      if (rejected < 5) return null;
      return `${rejected} of ${s.candidates.length} chunks scored below your similarity threshold and were rejected before top-K even looked at them. That's the threshold trading recall for precision — too strict starves the model, too loose feeds it noise.`;
    },
  },
  {
    id: "rerank-promotion",
    conceptId: "reranking",
    evaluate: s => {
      if (s.stages.rerank.status !== "done") return null;
      const promoted = s.candidates.find(
        c => c.rerankRank !== undefined && c.rerankRank <= s.params.topK && c.rank > s.params.topK,
      );
      if (!promoted) return null;
      return `Re-ranking just rescued chunk ${promoted.chunkId}: fast vector search ranked it #${promoted.rank} (outside your top ${s.params.topK}), but the LLM reader recognised its relevance and promoted it to #${promoted.rerankRank}. This is exactly what the second pass is for.`;
    },
  },
  {
    id: "context-underuse",
    conceptId: "context-window",
    evaluate: s => {
      if (s.stages.prompt.status !== "done") return null;
      const ctx = s.promptBlocks.find(b => b.label === "Retrieved Context");
      if (!ctx) return null;
      const pct = ctx.tokens / s.params.contextBudget;
      if (pct >= 0.4) return null;
      return `Your context window is only ${Math.round(pct * 100)}% full (${ctx.tokens} of ${s.params.contextBudget} tokens). You're reserving room you're not using — a higher top-K or larger chunks would put that space to work.`;
    },
  },
  {
    id: "budget-eviction",
    conceptId: "context-window",
    evaluate: s => {
      if (s.stages.prompt.status !== "done") return null;
      const passing = s.candidates.filter(c => c.hybrid >= s.params.threshold).length;
      const wanted = Math.min(passing, s.params.topK);
      if (wanted === 0 || s.results.length >= wanted) return null;
      const evicted = wanted - s.results.length;
      return `Retrieval selected ${wanted} chunks, but only ${s.results.length} fit your ${s.params.contextBudget}-token context budget — ${evicted} ${evicted === 1 ? "was" : "were"} evicted before the model ever saw ${evicted === 1 ? "it" : "them"}. The sneakiest failure mode: retrieval "worked", yet the evidence never arrived.`;
    },
  },
  {
    id: "zero-overlap",
    conceptId: "chunk-overlap",
    evaluate: s => {
      if (s.chunks.length === 0 || s.params.chunkOverlap !== 0) return null;
      return `Chunk overlap is set to 0 — every chunk boundary is now a place where a fact can be sliced in half, with neither half complete enough to retrieve. Watch for answers that miss conditions or caveats.`;
    },
  },
  {
    id: "hallucination-high",
    conceptId: "hallucination",
    evaluate: s => {
      if (!s.evalScores || s.evalScores.hallucinationRisk < 40) return null;
      return `The judge rates hallucination risk at ${s.evalScores.hallucinationRisk}/100 for this answer. Check which sentences lack citations first — then check whether retrieval actually delivered the evidence those sentences needed.`;
    },
  },
];

const COOLDOWN_MS = 20_000;   // at most one moment per 20 s
const AUTO_HIDE_MS = 16_000;  // linger long enough to read, never nag

/** Watches the store and surfaces at most one contextual micro-lesson at a time. */
export function useLearningMoments(): void {
  const seenRef = useRef<Set<string>>(new Set());
  const lastShownRef = useRef(0);

  // trigger re-evaluation only when a teachable transition can have happened
  const retrieveStatus = useRagStore(s => s.stages.retrieve.status);
  const rerankStatus = useRagStore(s => s.stages.rerank.status);
  const promptStatus = useRagStore(s => s.stages.prompt.status);
  const evalScores = useRagStore(s => s.evalScores);
  const chunkOverlap = useRagStore(s => s.params.chunkOverlap);
  const chunkCount = useRagStore(s => s.chunks.length);
  const activeMoment = useRagStore(s => s.activeMoment);

  useEffect(() => {
    const s = useRagStore.getState();
    if (s.activeMoment) return;
    const now = Date.now();
    if (now - lastShownRef.current < COOLDOWN_MS) return;

    for (const rule of MOMENT_RULES) {
      if (seenRef.current.has(rule.id)) continue;         // once per session
      if (s.dismissedMoments.includes(rule.id)) continue;  // "got it" persisted
      const text = rule.evaluate(s);
      if (text) {
        seenRef.current.add(rule.id);
        lastShownRef.current = now;
        s.showMoment({ id: rule.id, text, conceptId: rule.conceptId });
        break;
      }
    }
  }, [retrieveStatus, rerankStatus, promptStatus, evalScores, chunkOverlap, chunkCount, activeMoment]);

  // auto-hide (without permanently dismissing)
  useEffect(() => {
    if (!activeMoment) return;
    const t = setTimeout(() => useRagStore.getState().clearMoment(), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [activeMoment]);
}
