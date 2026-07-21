import type { TargetAndTransition } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════
   MOTION GRAMMAR (architecture §B1) — a fixed, documented vocabulary.
   Each token maps a MEANING to a MOTION, and every animated element in
   V2 must cite one. Consistency makes motion legible: when "settle"
   always means "done and trustworthy," the learner reads the pipeline
   like a sentence instead of watching fireworks.

   Every token defines a reduced-motion variant (§11): typically an
   instant state change carrying the same information through color,
   text, or a static highlight.
   ═══════════════════════════════════════════════════════════════════ */

export type GrammarToken =
  | "packet-flow" | "pulse" | "settle" | "recede" | "attract"
  | "fill" | "overflow" | "trace" | "shake";

export interface GrammarEntry {
  motion: string;      // what it looks like
  teaches: string;     // the meaning it encodes
  boundTo: string;     // the REAL data that triggers it (no decorative use)
  reduced: string;     // the static variant
}

export const GRAMMAR: Record<GrammarToken, GrammarEntry> = {
  "packet-flow": {
    motion: "glyph travels along an edge",
    teaches: "data is moving between stages",
    boundTo: "stage transition + real artifact counts",
    reduced: "edge highlights statically while the target stage runs",
  },
  pulse: {
    motion: "soft border breathing",
    teaches: "this component is computing",
    boundTo: 'stage status === "running"',
    reduced: "static running border + spinner badge",
  },
  settle: {
    motion: "scale 1.04→1 with glow fade-in",
    teaches: "work completed; the result is trustworthy",
    boundTo: 'stage status === "done"',
    reduced: "instant check badge + done colors",
  },
  recede: {
    motion: "opacity eases to 0.45",
    teaches: "not relevant right now",
    boundTo: "play-mode dimming / rejected candidates",
    reduced: "same opacity, no ease",
  },
  attract: {
    motion: "element eases toward a target",
    teaches: "semantic similarity — 'pulled closer'",
    boundTo: "cosine scores",
    reduced: "final position rendered immediately",
  },
  fill: {
    motion: "container fills bottom-up",
    teaches: "capacity being consumed",
    boundTo: "context-budget token counts",
    reduced: "fill level set instantly",
  },
  overflow: {
    motion: "item slides out of a container",
    teaches: "limits force exclusion",
    boundTo: "budget-trimmed chunks",
    reduced: "excluded item shown struck-through outside the vessel",
  },
  trace: {
    motion: "line draws point-to-point",
    teaches: "provenance — 'this came from that'",
    boundTo: "citations",
    reduced: "full line rendered immediately",
  },
  shake: {
    motion: "2px x-jitter, red",
    teaches: "something failed",
    boundTo: 'stage status === "error"',
    reduced: "static error border + message",
  },
};

export const GRAMMAR_TOKENS = Object.keys(GRAMMAR) as GrammarToken[];

/* ── concrete bindings ───────────────────────────────────────────────
   Pipeline node cards read their whole animation from one function so
   the grammar stays the single authority on what each state does. */

export type NodeStatus = "idle" | "running" | "done" | "error" | "stale";

export function nodeMotion(status: NodeStatus, recede: boolean, reduced: boolean): TargetAndTransition {
  // `recede` token — also the reduced-motion baseline for every state
  const base: TargetAndTransition = { opacity: recede ? 0.45 : 1 };
  if (reduced) return base;
  if (status === "done") {
    // `settle` token
    return { ...base, x: 0, scale: [1.04, 1], transition: { duration: 0.45, ease: "easeOut" } };
  }
  if (status === "error") {
    // `shake` token
    return { ...base, scale: 1, x: [0, -2, 2, -2, 2, 0], transition: { duration: 0.32 } };
  }
  return { ...base, scale: 1, x: 0 };
}

/** `packet-flow` pacing: packets stream within a bounded window so heavy
    stages read as "lots of traffic," never as a minutes-long parade. */
export const PACKET_TIMING = {
  travelMs: 620,          // one packet's journey along its edge
  maxWindowMs: 900,       // last packet departs within this window
  minWindowMs: 250,
} as const;
