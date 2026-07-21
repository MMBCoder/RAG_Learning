import type { Concept } from "./concepts";
import type { Voice } from "./personas";

/* Persona-voice composition (architecture §A4): concepts are written ONCE;
   the active persona's voice decides which field leads and what follows.
   One registry, five readings — never five copies. */

export interface ComposedConcept {
  lead: string;
  sections: { label: string; text: string }[];
}

export function composeConcept(c: Concept, voice: Voice): ComposedConcept {
  switch (voice) {
    case "analogy":       // student — meet them with the metaphor
      return {
        lead: c.analogy,
        sections: [
          { label: "in plain terms", text: c.plain },
          { label: "why RAG does this", text: c.why },
          { label: "when it goes wrong", text: c.misconfigured },
        ],
      };
    case "technical":     // engineer — definition first, failure modes next
      return {
        lead: c.technical,
        sections: [
          { label: "misconfiguration", text: c.misconfigured },
          { label: "retrieval impact", text: c.retrievalImpact },
          { label: "hallucination impact", text: c.hallucinationImpact },
        ],
      };
    case "statistical":   // researcher — definition, then measurable effects
      return {
        lead: c.technical,
        sections: [
          { label: "effect on retrieval quality", text: c.retrievalImpact },
          { label: "effect on hallucination risk", text: c.hallucinationImpact },
          { label: "failure mode", text: c.misconfigured },
        ],
      };
    case "business":      // executive — outcome language, risk before mechanism
      return {
        lead: c.plain,
        sections: [
          { label: "risk if wrong", text: c.hallucinationImpact },
          { label: "quality impact", text: c.retrievalImpact },
          { label: "why it exists", text: c.why },
        ],
      };
    case "narrative":     // presenter — story beats: plain, image, purpose
      return {
        lead: c.plain,
        sections: [
          { label: "the picture", text: c.analogy },
          { label: "why it matters", text: c.why },
        ],
      };
  }
}
