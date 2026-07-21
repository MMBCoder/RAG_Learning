import type { FeatureId } from "../store/appTypes";

/* Educational objective mapping (architecture §A6) — CI-enforced:
   every feature surface must serve ≥1 objective, and every registered
   screen must answer all four museum questions. A feature that can't
   state its lesson doesn't ship. */

export type QuestionKey = "what" | "why" | "quality" | "improve";

export interface EducationalObjective {
  id: string;
  statement: string;   // "Learner can …"
  answers: QuestionKey[];
}

export const OBJECTIVES: Record<string, EducationalObjective> = {
  "pipeline-shape": {
    id: "pipeline-shape",
    statement: "Learner can name the stages a document and a question pass through, in order.",
    answers: ["what"],
  },
  "chunks-are-the-unit": {
    id: "chunks-are-the-unit",
    statement: "Learner can explain that retrieval happens over chunks, not documents, and why chunk size matters.",
    answers: ["what", "why", "quality"],
  },
  "meaning-has-geometry": {
    id: "meaning-has-geometry",
    statement: "Learner can explain embeddings as coordinates where similar meaning = nearby points.",
    answers: ["what", "why"],
  },
  "retrieval-tradeoffs": {
    id: "retrieval-tradeoffs",
    statement: "Learner can predict how top-K, threshold, and hybrid blend trade precision against recall.",
    answers: ["quality", "improve"],
  },
  "prompt-is-assembled": {
    id: "prompt-is-assembled",
    statement: "Learner can describe the prompt as an assembled package (rules + evidence + question) with a finite budget.",
    answers: ["what", "why"],
  },
  "grounding-verifiability": {
    id: "grounding-verifiability",
    statement: "Learner can trace an answer sentence to its source chunk and explain why citations make answers checkable.",
    answers: ["what", "quality"],
  },
  "hallucination-is-measurable": {
    id: "hallucination-is-measurable",
    statement: "Learner can explain hallucination as measurable and reducible via retrieval and prompt controls.",
    answers: ["quality", "improve"],
  },
  "params-cause-effect": {
    id: "params-cause-effect",
    statement: "Learner can change a parameter, observe the effect, and articulate the causal chain.",
    answers: ["improve", "quality"],
  },
  "cost-awareness": {
    id: "cost-awareness",
    statement: "Learner can identify which operations cost money/time and which dials move the price.",
    answers: ["what", "improve"],
  },
  "evaluation-literacy": {
    id: "evaluation-literacy",
    statement: "Learner can interpret faithfulness/relevance/precision/recall scores and their limits (judge, not ground truth).",
    answers: ["what", "quality"],
  },
  "audience-lenses": {
    id: "audience-lenses",
    statement: "Learner understands the same system can be truthfully described at different depths for different audiences.",
    answers: ["what", "why"],
  },
  "guided-progression": {
    id: "guided-progression",
    statement: "First-time learner is led from ingestion to experimentation without facing every feature at once.",
    answers: ["what", "improve"],
  },
};

export const OBJECTIVE_IDS = Object.keys(OBJECTIVES);

/** Every FeatureId must appear here with ≥1 valid objective (CI test). */
export const FEATURE_OBJECTIVES: Record<FeatureId, string[]> = {
  "pipeline-canvas": ["pipeline-shape"],
  "inspector": ["chunks-are-the-unit", "prompt-is-assembled", "evaluation-literacy"],
  "play-mode": ["pipeline-shape", "guided-progression"],
  "timeline": ["pipeline-shape", "cost-awareness"],
  "universe": ["meaning-has-geometry"],
  "detective": ["grounding-verifiability"],
  "brain": ["prompt-is-assembled", "grounding-verifiability"],
  "prompt-mri": ["prompt-is-assembled"],
  "context-window": ["prompt-is-assembled", "retrieval-tradeoffs"],
  "cost-meter": ["cost-awareness"],
  "playground": ["params-cause-effect", "retrieval-tradeoffs"],
  "lab": ["params-cause-effect", "hallucination-is-measurable"],
  "coach": ["params-cause-effect", "cost-awareness"],
  "radar": ["hallucination-is-measurable", "evaluation-literacy"],
  "chunk-story": ["chunks-are-the-unit"],
  "heatmap": ["chunks-are-the-unit", "retrieval-tradeoffs"],
  "presentation": ["pipeline-shape", "audience-lenses"],
  "journey": ["guided-progression"],
  "sound": ["pipeline-shape"],
};

/** Registered screens; each must answer the four museum questions (CI test). */
export type ScreenId =
  | "pipeline-canvas" | "inspector" | "parameters" | "metrics" | "answer"
  | "play-overlay" | "journey-card" | "timeline" | "detective" | "playground" | "lab" | "presentation";

export const SCREEN_ANSWERS: Record<ScreenId, Record<QuestionKey, string>> = {
  "pipeline-canvas": {
    what: "Node status, notes, and timings show which stage is doing what, live.",
    why: "Stage blurbs and the two labelled rows explain each stage's role in document→answer.",
    quality: "Error/stale states and stage notes reveal where quality is created or lost.",
    improve: "Clicking any node opens its inspector with concept guidance and linked parameters.",
  },
  "inspector": {
    what: "Per-stage explanation, live input/output artifacts, and processing time.",
    why: "The stage's lead concept explains why the pipeline includes this step.",
    quality: "Concept sections spell out retrieval-quality and hallucination impact.",
    improve: "Linked parameter chips jump to (and pulse) the exact slider that tunes this stage.",
  },
  "parameters": {
    what: "Current values of every pipeline dial, grouped by stage.",
    why: "Each label opens its concept card explaining the dial's purpose.",
    quality: "Stale-propagation shows which results a change invalidates; instant re-scoring shows effects live.",
    improve: "The dials ARE the improvement mechanism; hints state each trade-off's direction.",
  },
  "metrics": {
    what: "Timings, token flows, cost, and evaluation scores of the current session.",
    why: "Tile concepts explain what each number measures and where it comes from.",
    quality: "Faithfulness and hallucination risk quantify answer quality directly.",
    improve: "Stage latency bars and cost tiles point at the expensive dials to revisit.",
  },
  "answer": {
    what: "The grounded answer with citations, next to the exact source chunks.",
    why: "Hover-tracing demonstrates why citations exist: every claim maps to evidence.",
    quality: "Uncited sentences and thin sources are visible at a glance.",
    improve: "Weak answers invite retrieval-parameter changes; sources show what retrieval delivered.",
  },
  "play-overlay": {
    what: "Narrated progress through every stage with live step count.",
    why: "Narration explains each stage's purpose as it runs.",
    quality: "Narration ties stage behaviour to answer quality as the story unfolds.",
    improve: "The closing beat directs learners to parameters and inspection to go deeper.",
  },
  "journey-card": {
    what: "The current chapter names the one action to take next and shows overall progress.",
    why: "Each chapter's goal paragraph states the lesson behind the action, with its lead concept one tap away.",
    quality: "Chapters sequence toward quality levers: tuning parameters and re-asking is itself a chapter.",
    improve: "Completion comes only from really doing the action — the journey is practice, not reading.",
  },
  "timeline": {
    what: "Every stage of the last run as a block whose width is its real measured duration.",
    why: "The latency concept explains why network stages dwarf local math — the shape of the strip IS the lesson.",
    quality: "Scrubbing shows exactly which artifacts existed at each moment, exposing where quality was created.",
    improve: "Watching a stage again after changing a parameter shows the causal chain replayed on demand.",
  },
  "playground": {
    what: "Two configurations of the same question, side by side: params changed, chunks gained and lost, scores overlaid.",
    why: "The A/B verdict explains WHY outcomes differ — every sentence cites the measured diff it was built from.",
    quality: "Radar overlay and retrieval sets show exactly where quality moved between A and B.",
    improve: "Pin, change one dial, run B — the improvement loop itself, with honest re-embed cost previews.",
  },
  "lab": {
    what: "Nine sabotage presets, each stating the dials it will move before it moves them.",
    why: "Hypothesis-first: the preset predicts the damage, so the run becomes a test of your understanding.",
    quality: "Verdicts come from the same measured A/B engine — predictions meet real scores.",
    improve: "Breaking a pipeline on purpose is the fastest way to learn which dial protects what.",
  },
  "detective": {
    what: "One answer sentence walked backwards: claim → evidence → prompt slot → retrieval scores → the page.",
    why: "Each step names its concept — grounding, citations, prompt construction, hybrid search — as the trail passes through it.",
    quality: "Support verdicts and real scores show precisely where a claim's backing is strong, partial, or missing.",
    improve: "Unsupported claims get an evidence hunt whose diagnosis points at the exact dial: threshold, top-K, or the model itself.",
  },
  "presentation": {
    what: "Fullscreen big-type narration of the whole pipeline, one stage at a time, with live progress.",
    why: "Each beat quotes the stage's registry concept — the show and the lesson are the same script.",
    quality: "The finale recap shows the run's real timings, judge scores, cost, and coach suggestions.",
    improve: "Speaker notes hand the presenter the plain answer, the technical answer, and the war story for every stage.",
  },
};
