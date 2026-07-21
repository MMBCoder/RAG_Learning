import type { RagParams } from "../ragStore";
import { EXPERIMENT_LABELS, type ExperimentId, type ConceptId } from "../education/concepts";

/* AI Lab presets (F12): break it on purpose, hypothesis FIRST. Each
   preset states its prediction before running — the "Aha!" is comparing
   the prediction against the measured outcome. The nine ids have lived
   in the Concept Registry since M1; this is where they become runnable. */

export interface LabExperiment {
  id: ExperimentId;
  label: string;
  conceptId: ConceptId;
  /** the prediction, stated before the run */
  hypothesis: string;
  apply: Partial<RagParams>;
  /** chunking changes force a re-embed (real cost — previewed) */
  needsReembed: boolean;
}

export const LAB_EXPERIMENTS: LabExperiment[] = [
  {
    id: "no-overlap", label: EXPERIMENT_LABELS["no-overlap"], conceptId: "chunk-overlap",
    hypothesis: "Facts near chunk boundaries will be sliced in half; expect weaker retrieval for boundary-straddling questions and a faithfulness dip.",
    apply: { chunkOverlap: 0 }, needsReembed: true,
  },
  {
    id: "giant-chunks", label: EXPERIMENT_LABELS["giant-chunks"], conceptId: "chunking",
    hypothesis: "Each chunk will mix topics: similarity scores blur, fewer chunks fit the budget, and context precision drops.",
    apply: { chunkSize: 1600 }, needsReembed: true,
  },
  {
    id: "tiny-chunks", label: EXPERIMENT_LABELS["tiny-chunks"], conceptId: "chunking",
    hypothesis: "Facts fragment across many small chunks: no single chunk answers alone, so recall of complete answers drops.",
    apply: { chunkSize: 200 }, needsReembed: true,
  },
  {
    id: "top-k-1", label: EXPERIMENT_LABELS["top-k-1"], conceptId: "top-k",
    hypothesis: "Everything rides on one chunk being complete; expect missing caveats and a context-recall drop.",
    apply: { topK: 1 }, needsReembed: false,
  },
  {
    id: "top-k-8", label: EXPERIMENT_LABELS["top-k-8"], conceptId: "top-k",
    hypothesis: "More evidence, more noise: context precision falls and cost rises while faithfulness barely moves.",
    apply: { topK: 8 }, needsReembed: false,
  },
  {
    id: "rerank-off", label: EXPERIMENT_LABELS["rerank-off"], conceptId: "reranking",
    hypothesis: "The fast ranking stands unreviewed; a subtly-relevant chunk may miss the cut and citations weaken.",
    apply: { useRerank: false }, needsReembed: false,
  },
  {
    id: "keyword-only", label: EXPERIMENT_LABELS["keyword-only"], conceptId: "keyword-search",
    hypothesis: "Paraphrased questions stop matching: retrieval works only when the answer shares your exact words.",
    apply: { hybridAlpha: 0 }, needsReembed: false,
  },
  {
    id: "semantic-only", label: EXPERIMENT_LABELS["semantic-only"], conceptId: "semantic-search",
    hypothesis: "Meaning-matching alone misses exact identifiers; conceptual questions hold up, code-like lookups degrade.",
    apply: { hybridAlpha: 1 }, needsReembed: false,
  },
  {
    id: "starved-context", label: EXPERIMENT_LABELS["starved-context"], conceptId: "context-window",
    hypothesis: "Retrieved chunks get evicted before the model sees them; expect gaps the model fills — hallucination risk up.",
    apply: { contextBudget: 500 }, needsReembed: false,
  },
];

export const LAB_BY_ID = Object.fromEntries(LAB_EXPERIMENTS.map(e => [e.id, e])) as Record<ExperimentId, LabExperiment>;
