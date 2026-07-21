import type { StageId } from "../ragStore";
import type { ConceptId } from "../education/concepts";

/* Arc 3 — "The anatomy of an answer" (architecture §B3). The Detective
   walks it BACKWARDS: claim → evidence → prompt → scores → page. Each
   step spotlights its pipeline stage and quotes its registry concept;
   the Brain (M10) shares the same arc forwards. */

export interface AnatomyStep {
  id: "claim" | "evidence" | "placement" | "scores" | "source";
  title: string;
  stage: StageId;        // the Director spotlights this node
  conceptId: ConceptId;
  lesson: string;        // the beat's teaching line (museum voice)
}

export const ANATOMY_STEPS: AnatomyStep[] = [
  {
    id: "claim",
    title: "the claim",
    stage: "ground",
    conceptId: "grounding",
    lesson: "Every sentence of an answer is a claim, and every claim either has receipts or it doesn't. This one is where our trail starts.",
  },
  {
    id: "evidence",
    title: "the evidence",
    stage: "retrieve",
    conceptId: "citations",
    lesson: "The citation points at real passages. Here they are — with the exact scores that got them retrieved.",
  },
  {
    id: "placement",
    title: "inside the prompt",
    stage: "prompt",
    conceptId: "prompt-construction",
    lesson: "Evidence only counts if it physically made it into the model's briefing pack. This is where it sat, and how much of the budget it used.",
  },
  {
    id: "scores",
    title: "why retrieval chose it",
    stage: "rerank",
    conceptId: "hybrid-search",
    lesson: "Meaning-match, word-match, and a second reading each voted. These are the actual numbers behind the selection.",
  },
  {
    id: "source",
    title: "back to the page",
    stage: "parse",
    conceptId: "pdf-parsing",
    lesson: "The end of the trail: a physical place in your document. Verifiability means being able to stand here.",
  },
];
