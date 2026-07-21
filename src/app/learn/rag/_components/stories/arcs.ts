import type { RagStore, StageId } from "../ragStore";
import { CONCEPTS, STAGE_CONCEPT, type Concept } from "../education/concepts";
import type { Voice } from "../education/personas";
import type { GrammarToken } from "../motion/grammar";

/* ═══════════════════════════════════════════════════════════════════
   NARRATIVE ARCS (architecture §B3). Two scripted arcs give the
   pipeline a beginning, tension, and resolution:

     Arc 1 · "The journey of a document"  — upload → index
     Arc 2 · "The journey of a question"  — query → evaluate

   Every beat is TWO-PHASE:
   · intro  — spoken as the stage starts; quotes the Concept Registry
              VERBATIM in the active persona's voice (one registry,
              five readings — never new copy).
   · payoff — spoken when the stage lands; quotes the REAL numbers the
              stage just produced. No number is invented.
   ═══════════════════════════════════════════════════════════════════ */

export interface StoryBeat {
  stage: StageId;
  arc: 1 | 2;
  /** grammar tokens active during this beat (motion citations) */
  tokens: GrammarToken[];
  /** live-data payoff line — real numbers only */
  payoff: (s: RagStore) => string;
}

const clip = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export const BEATS: StoryBeat[] = [
  {
    stage: "upload", arc: 1, tokens: ["pulse", "settle"],
    payoff: s => `${s.docName ?? "The document"} is checked in — ${s.docBytes > 1024 * 1024 ? `${(s.docBytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(s.docBytes / 1024))} KB`} accepted at the loading dock.`,
  },
  {
    stage: "parse", arc: 1, tokens: ["packet-flow", "pulse", "settle"],
    payoff: s => `${s.pages.length} page${s.pages.length === 1 ? "" : "s"} of raw text pulled out, page numbers preserved for provenance.`,
  },
  {
    stage: "clean", arc: 1, tokens: ["packet-flow", "pulse", "settle"],
    payoff: s => s.cleanStats
      ? `${s.cleanStats.joinedLines} broken lines stitched back into sentences; ${Math.max(0, s.cleanStats.before - s.cleanStats.after)} junk characters removed.`
      : "The text is ironed flat and readable.",
  },
  {
    stage: "chunk", arc: 1, tokens: ["packet-flow", "pulse", "settle"],
    payoff: s => `${s.chunks.length} chunks cut along sentence boundaries — about ${s.chunks.length ? Math.round(s.chunks.reduce((n, c) => n + c.chars, 0) / s.chunks.length) : 0} characters each. These are the units search will work with.`,
  },
  {
    stage: "tokenize", arc: 1, tokens: ["pulse", "settle"],
    payoff: s => `≈ ${s.chunks.reduce((n, c) => n + c.tokens, 0).toLocaleString()} tokens counted — the currency every cost and limit downstream is priced in.`,
  },
  {
    stage: "embed", arc: 1, tokens: ["packet-flow", "pulse", "settle"],
    payoff: s => `${s.embeddings.length} vectors of ${s.embeddings[0]?.length ?? 0} dimensions — every chunk now has coordinates on the map of meaning.`,
  },
  {
    stage: "index", arc: 1, tokens: ["settle"],
    payoff: s => `${s.embeddings.length} vectors indexed. The document's memory is built — ask it anything.`,
  },
  {
    stage: "query", arc: 2, tokens: ["packet-flow", "pulse", "settle"],
    payoff: s => `“${clip(s.query)}” is now a ${s.queryVec?.length ?? 0}-dimensional point on the same map as the chunks.`,
  },
  {
    stage: "retrieve", arc: 2, tokens: ["packet-flow", "attract", "settle"],
    payoff: s => `${s.results.length} of ${s.candidates.length} chunks pass the threshold — the closest points to the question win.`,
  },
  {
    stage: "rerank", arc: 2, tokens: ["pulse", "settle", "recede"],
    payoff: s => s.stages.rerank.note?.startsWith("skipped")
      ? `Re-ranking ${s.stages.rerank.note}. The fast ranking stands.`
      : `The shortlist was actually READ this time: ${s.stages.rerank.note ?? "reordered by a stronger judge"}.`,
  },
  {
    stage: "prompt", arc: 2, tokens: ["fill", "settle"],
    payoff: s => `${s.promptBlocks.reduce((n, b) => n + b.tokens, 0).toLocaleString()} tokens assembled: rules, ${s.results.length} labelled evidence chunks, and the question. This package is everything the model will know.`,
  },
  {
    stage: "generate", arc: 2, tokens: ["packet-flow", "pulse", "settle"],
    payoff: s => `The answer arrived — ${s.answer ? `${s.answer.split(/\s+/).length} words` : "written"}, built token by token from the briefing pack alone.`,
  },
  {
    stage: "ground", arc: 2, tokens: ["trace", "settle"],
    payoff: s => {
      const cited = s.answerSentences.filter(x => x.citations.length > 0).length;
      return `${cited} of ${s.answerSentences.length} sentences carry citations — each one traceable to its exact source passage.`;
    },
  },
  {
    stage: "evaluate", arc: 2, tokens: ["settle"],
    payoff: s => s.evalScores
      ? `The judge's verdict: faithfulness ${s.evalScores.faithfulness}/100, hallucination risk ${s.evalScores.hallucinationRisk}/100. A judgment, not ground truth — but now it's measured.`
      : "The judge has read the answer against the evidence.",
  },
];

export const BEAT_BY_STAGE: Record<string, StoryBeat> =
  Object.fromEntries(BEATS.map(b => [b.stage, b]));

/* ── persona-voice narration: intro quotes the registry VERBATIM ── */

function voicedLead(c: Concept, voice: Voice): string {
  switch (voice) {
    case "analogy": return c.analogy;
    case "technical": return c.technical;
    case "statistical": return c.technical;
    case "business": return c.plain;
    case "narrative": return c.plain;
  }
}

/** Spoken as the stage starts — the registry's words, the persona's voice. */
export function beatIntro(stage: StageId, voice: Voice): string {
  const c = CONCEPTS[STAGE_CONCEPT[stage]];
  return `${c.term}. ${voicedLead(c, voice)}`;
}

/** Spoken when the stage lands — real numbers from the live store. */
export function beatPayoff(stage: StageId, s: RagStore): string {
  return BEAT_BY_STAGE[stage].payoff(s);
}
