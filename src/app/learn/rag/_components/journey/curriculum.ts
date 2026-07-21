import type { ConceptId } from "../education/concepts";
import type { RagParams, StageId } from "../store/types";

/* ═══════════════════════════════════════════════════════════════════
   LEARNING JOURNEY (architecture §A5) — the curriculum.

   Eight chapters turn the feature set from a wall into a plot. Chapters
   whose features ship in later milestones (Detective M9, Lab & A/B M12)
   are REGISTERED here but inactive — never rendered as placeholders;
   they activate when their feature lands.

   Completion is detected from real store state, never from "clicked
   next": the signal tracker below latches achievements from actual
   pipeline transitions, and each chapter declares which signal
   completes it. Both halves are pure and unit-tested.
   ═══════════════════════════════════════════════════════════════════ */

export type ChapterId =
  | "ingest" | "first-question" | "open-node" | "trace-source"
  | "tune-and-ask" | "break-it" | "compare" | "present";

/** Achievements latched from real pipeline activity (never unlatched
    except by a journey restart). */
export interface JourneySignals {
  ingested: boolean;           // a document made it through ingestion
  answered: boolean;           // a grounded answer exists
  openedNode: boolean;         // the inspector was opened on some stage
  tracedSource: boolean;       // a detective walk reached the source step (M9)
  tunedParam: boolean;         // any parameter changed from its observed value
  ranExperiment: boolean;      // a lab experiment completed (M12)
  comparedConfigs: boolean;    // an A/B comparison was viewed (M12)
  answeredAfterTune: boolean;  // a NEW answer arrived after a parameter change
  playStarted: boolean;        // Play Mode was launched
}

export interface Chapter {
  id: ChapterId;
  title: string;
  /** Why this chapter exists — the lesson, in museum voice. */
  goal: string;
  /** What to actually do, concretely, with today's controls. */
  hint: string;
  /** Registry concepts this chapter clusters around (first = lead). */
  conceptIds: ConceptId[];
  /** Inactive chapters are registered but invisible until their feature ships. */
  active: boolean;
  /** Element the Journey gently highlights while this chapter is current. */
  spotlight?: "load-sample";
  isComplete: (sig: JourneySignals) => boolean;
}

export const CHAPTERS: Chapter[] = [
  {
    id: "ingest",
    title: "Ingest a document",
    goal: "Everything begins with a document. Watch the top row light up as a PDF becomes clean text, then chunks, then vectors — the pipeline's entire memory is built in these few seconds.",
    hint: "Click “load sample” (or upload any PDF up to 5 MB) and watch the ingestion row run.",
    conceptIds: ["document-ingestion", "chunking", "embeddings"],
    active: true,
    spotlight: "load-sample",
    isComplete: sig => sig.ingested,
  },
  {
    id: "first-question",
    title: "Ask your first question",
    goal: "This is the moment RAG earns its name: your question becomes a vector, the index finds the closest passages, and the model answers from that evidence — not from its memory.",
    hint: "Type a question about the document in the ask bar (or use a suggested one) and send it.",
    conceptIds: ["query-embedding", "semantic-search", "grounding"],
    active: true,
    isComplete: sig => sig.answered,
  },
  {
    id: "open-node",
    title: "Open a pipeline node",
    goal: "Nothing here is a black box. Every stage keeps its real artifacts — pages, chunks, vectors, scores — and shows them to anyone who clicks.",
    hint: "Click any stage in the pipeline map to open its inspector. Embeddings is a good first stop.",
    conceptIds: ["embeddings", "cosine-similarity"],
    active: true,
    isComplete: sig => sig.openedNode,
  },
  {
    id: "trace-source",
    title: "Trace an answer to its source",
    goal: "A grounded answer is a checkable answer. Follow one sentence backwards through its citation to the exact passage — and page — it came from.",
    hint: "Click any sentence of an answer (or “trace this answer”) and walk the detective's five steps to the source.",
    conceptIds: ["citations", "grounding"],
    active: true,    // activated with Evidence Detective (M9)
    isComplete: sig => sig.tracedSource,
  },
  {
    id: "tune-and-ask",
    title: "Tune a parameter and re-ask",
    goal: "RAG quality is not fixed — it is chosen. Move one dial, ask again, and watch retrieval, the prompt, and the answer change in response. This cause-and-effect loop is the whole craft.",
    hint: "Open the parameters dock, change top-K or the similarity threshold, then ask your question again.",
    conceptIds: ["top-k", "similarity-threshold", "chunk-overlap"],
    active: true,
    isComplete: sig => sig.answeredAfterTune,
  },
  {
    id: "break-it",
    title: "Break it on purpose",
    goal: "The fastest way to understand a system is to watch it fail on your terms. Run a sabotage preset and diagnose the damage in the metrics.",
    hint: "Open the ai lab tab in the dock and run any experiment — predict first, then check the verdict.",
    conceptIds: ["hallucination", "chunk-overlap"],
    active: true,    // activated with the AI Lab (M12)
    isComplete: sig => sig.ranExperiment,
  },
  {
    id: "compare",
    title: "Compare two configurations",
    goal: "Opinion ends where measurement begins: run the same question under two configurations and let the evaluation scores settle the argument.",
    hint: "Pin a run as A in the playground tab, change a dial, and run B with the same question.",
    conceptIds: ["evaluation", "faithfulness"],
    active: true,    // activated with the Playground (M12)
    isComplete: sig => sig.comparedConfigs,
  },
  {
    id: "present",
    title: "Present it to someone",
    goal: "The final test of understanding is explaining it to someone else. Play Mode turns the pipeline into a narrated story you can hand to a friend, a class, or a boardroom.",
    hint: "Press “play mode” and let the pipeline explain itself end to end.",
    conceptIds: ["grounding"],
    active: true,
    isComplete: sig => sig.playStarted,
  },
];

/** The chapters a learner actually sees, in order. Numbering shown in the
    UI is 1-based within THIS list, so no gaps appear while later chapters
    are inactive. */
export const ACTIVE_CHAPTERS = CHAPTERS.filter(c => c.active);

/* ── signal tracker — pure, fixture-testable ─────────────────────────
   advanceTrack() consumes successive views of the store and latches
   signals. Sequence-dependent signals (tune THEN re-ask) compare against
   the previous view, so a real ordering of actions is required. */

/** The narrow store view the tracker observes. */
export interface JourneyView {
  ingested: boolean;
  answer: string | null;
  selected: StageId | null;
  playActive: boolean;
  detectiveTraced: boolean;
  labRuns: number;
  comparedRuns: number;
  params: RagParams;
}

export interface JourneyTrack {
  signals: JourneySignals;
  lastParams: RagParams | null;
  lastAnswer: string | null;
}

export const emptyTrack = (): JourneyTrack => ({
  signals: {
    ingested: false, answered: false, openedNode: false, tracedSource: false,
    ranExperiment: false, comparedConfigs: false,
    tunedParam: false, answeredAfterTune: false, playStarted: false,
  },
  lastParams: null,
  lastAnswer: null,
});

const paramsEqual = (a: RagParams, b: RagParams): boolean =>
  (Object.keys(a) as (keyof RagParams)[]).every(k => a[k] === b[k]);

export function advanceTrack(t: JourneyTrack, v: JourneyView): JourneyTrack {
  const tunedNow = t.lastParams !== null && !paramsEqual(t.lastParams, v.params);
  // a NEW answer: either the previous view had none, or the text changed
  const newAnswer = v.answer !== null && (t.lastAnswer === null || v.answer !== t.lastAnswer);
  const prev = t.signals;
  return {
    signals: {
      ingested: prev.ingested || v.ingested,
      answered: prev.answered || v.answer !== null,
      openedNode: prev.openedNode || v.selected !== null,
      tracedSource: prev.tracedSource || v.detectiveTraced,
      ranExperiment: prev.ranExperiment || v.labRuns > 0,
      comparedConfigs: prev.comparedConfigs || v.comparedRuns > 0,
      tunedParam: prev.tunedParam || tunedNow,
      // strict ordering: the tune must have been latched BEFORE this answer
      answeredAfterTune: prev.answeredAfterTune || (newAnswer && prev.tunedParam),
      playStarted: prev.playStarted || v.playActive,
    },
    lastParams: v.params,
    lastAnswer: v.answer,
  };
}
