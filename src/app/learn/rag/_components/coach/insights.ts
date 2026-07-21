import type { RagStore, RagParams } from "../ragStore";
import type { ConceptId } from "../education/concepts";

/* Smart Coach (F14): ranked, data-driven suggestions with one-click
   apply through the EXISTING param plumbing. Every insight quotes the
   real numbers that triggered it, and disappears the moment the
   condition it describes is gone — addressed insights don't nag. */

export interface CoachInsight {
  id: string;
  severity: 1 | 2 | 3;          // 3 = most important
  conceptId: ConceptId;
  text: string;
  apply?: { label: string; params: Partial<RagParams> };
}

export type CoachState = Pick<
  RagStore, "stages" | "candidates" | "results" | "params" | "promptBlocks" | "evalScores" | "answerSentences" | "chunks"
>;

export function coachInsights(s: CoachState): CoachInsight[] {
  const out: CoachInsight[] = [];
  const queryDone = s.stages.evaluate.status === "done";

  if (queryDone && s.evalScores && s.evalScores.hallucinationRisk >= 40) {
    const uncited = s.answerSentences.filter(x => x.citations.length === 0).length;
    out.push({
      id: "high-risk", severity: 3, conceptId: "hallucination",
      text: `Hallucination risk is ${s.evalScores.hallucinationRisk}/100 and ${uncited} sentence${uncited === 1 ? "" : "s"} carry no citation. Raising the similarity threshold feeds the model less questionable evidence.`,
      apply: { label: `threshold ${s.params.threshold.toFixed(2)} → ${Math.min(0.8, s.params.threshold + 0.05).toFixed(2)}`, params: { threshold: Math.min(0.8, s.params.threshold + 0.05) } },
    });
  }

  const ctx = s.promptBlocks.find(b => b.label === "Retrieved Context");
  if (queryDone && ctx && ctx.tokens / s.params.contextBudget < 0.4 && s.params.topK < 8) {
    out.push({
      id: "under-used-budget", severity: 2, conceptId: "context-window",
      text: `Only ${Math.round((ctx.tokens / s.params.contextBudget) * 100)}% of your ${s.params.contextBudget}-token budget is used. A higher top-K puts the reserved space to work.`,
      apply: { label: `top-K ${s.params.topK} → ${Math.min(8, s.params.topK + 2)}`, params: { topK: Math.min(8, s.params.topK + 2) } },
    });
  }

  if (s.stages.retrieve.status === "done" && s.candidates.length > 0) {
    const passing = s.candidates.filter(c => c.hybrid >= s.params.threshold).length;
    if (passing < Math.min(s.params.topK, s.candidates.length) && s.params.threshold > 0.05) {
      out.push({
        id: "threshold-starving", severity: 3, conceptId: "similarity-threshold",
        text: `Only ${passing} of ${s.candidates.length} chunks clear your ${s.params.threshold.toFixed(2)} threshold — fewer than the ${s.params.topK} you asked for. The bar may be starving retrieval.`,
        apply: { label: `threshold ${s.params.threshold.toFixed(2)} → ${Math.max(0, s.params.threshold - 0.05).toFixed(2)}`, params: { threshold: Math.max(0, s.params.threshold - 0.05) } },
      });
    }
  }

  if (queryDone && !s.params.useRerank && s.candidates.length >= 6) {
    out.push({
      id: "rerank-off", severity: 1, conceptId: "reranking",
      text: `${s.candidates.length} candidates competed with re-ranking off — the fast ranking stood unreviewed. A second pass often rescues a subtly-relevant chunk.`,
      apply: { label: "enable re-ranking", params: { useRerank: true } },
    });
  }

  if (queryDone && s.results.length > 0) {
    const passing = s.candidates.filter(c => c.hybrid >= s.params.threshold).length;
    const wanted = Math.min(passing, s.params.topK);
    if (s.results.length < wanted) {
      out.push({
        id: "budget-eviction", severity: 2, conceptId: "context-window",
        text: `Retrieval selected ${wanted} chunks but only ${s.results.length} fit the ${s.params.contextBudget}-token budget. Evicted evidence is invisible failure — a bigger vessel fixes it.`,
        apply: { label: `budget ${s.params.contextBudget} → ${Math.min(6000, s.params.contextBudget + 500)}`, params: { contextBudget: Math.min(6000, s.params.contextBudget + 500) } },
      });
    }
  }

  return out.sort((a, b) => b.severity - a.severity);
}
