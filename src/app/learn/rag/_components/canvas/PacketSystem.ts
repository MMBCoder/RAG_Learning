"use client";

import { useRagStore, type RagStore, type StageId } from "../ragStore";
import { prefersReducedMotion } from "../motion/reducedMotion";
import { PACKET_TIMING } from "../motion/grammar";

/* ═══════════════════════════════════════════════════════════════════
   PACKET SYSTEM — the `packet-flow` grammar token (architecture §5,
   animation layer 3). Subscribes to the store OUTSIDE React and writes
   transform attributes imperatively into the EdgeLayer SVG: React owns
   the SVG container and the static paths, never the moving dots.

   Honesty rule: every packet burst is bound to a REAL artifact count —
   23 chunks means 23 packets (visually batched above MAX_PACKETS). The
   glyph reflects the payload: pages → chunks → vectors → the answer.
   ═══════════════════════════════════════════════════════════════════ */

export interface EdgeDef {
  id: string;
  from: StageId;
  to: StageId;
  /** payload-shaped glyph the packets carry */
  glyph: string;
  /** REAL count of things flowing, read at the moment the target starts */
  count: (s: RagStore) => number;
}

export const PIPELINE_EDGES: EdgeDef[] = [
  { id: "upload-parse", from: "upload", to: "parse", glyph: "▣", count: () => 1 },                      // the document
  { id: "parse-clean", from: "parse", to: "clean", glyph: "▤", count: s => s.pages.length },            // pages
  { id: "clean-chunk", from: "clean", to: "chunk", glyph: "▤", count: s => s.cleanedPages.length || s.pages.length },
  { id: "chunk-tokenize", from: "chunk", to: "tokenize", glyph: "▦", count: s => s.chunks.length },     // chunks
  { id: "tokenize-embed", from: "tokenize", to: "embed", glyph: "▦", count: s => s.chunks.length },
  { id: "embed-index", from: "embed", to: "index", glyph: "⟨⟩", count: s => s.embeddings.length || s.chunks.length }, // vectors
  { id: "index-query", from: "index", to: "query", glyph: "✦", count: () => 1 },                        // the question
  { id: "query-retrieve", from: "query", to: "retrieve", glyph: "⟨⟩", count: () => 1 },                 // the query vector
  { id: "retrieve-rerank", from: "retrieve", to: "rerank", glyph: "▦", count: s => Math.min(s.candidates.length, 8) }, // shortlist
  { id: "rerank-prompt", from: "rerank", to: "prompt", glyph: "▦", count: s => s.results.length || s.params.topK },    // evidence set
  { id: "prompt-generate", from: "prompt", to: "generate", glyph: "✉", count: () => 1 },                // the assembled prompt
  { id: "generate-ground", from: "generate", to: "ground", glyph: "❝", count: s => s.answerSentences.length || 1 },   // sentences
  { id: "ground-evaluate", from: "ground", to: "evaluate", glyph: "✓", count: () => 1 },                // the verdict request
];

export const MAX_PACKETS = 40;

export interface PacketPlan {
  edgeId: string;
  glyph: string;
  count: number;     // visible packets (capped)
  real: number;      // the honest number
  batched: boolean;  // true when real > MAX_PACKETS
}

/** Pure scheduling: a burst fires exactly when the edge's target stage
    STARTS running with its source done. Unit-tested against fixtures. */
export function planPackets(edge: EdgeDef, prev: RagStore, next: RagStore): PacketPlan | null {
  const started =
    prev.stages[edge.to].status !== "running" && next.stages[edge.to].status === "running";
  if (!started) return null;
  if (next.stages[edge.from].status !== "done") return null;
  const real = Math.max(1, edge.count(next));
  return {
    edgeId: edge.id,
    glyph: edge.glyph,
    count: Math.min(real, MAX_PACKETS),
    real,
    batched: real > MAX_PACKETS,
  };
}

/* ── the imperative runtime ──────────────────────────────────────── */

interface LivePacket {
  el: SVGTextElement;
  path: SVGPathElement;
  len: number;
  start: number;
  dur: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export class PacketSystem {
  private svg: SVGSVGElement;
  private packets: LivePacket[] = [];
  private raf = 0;
  private unsub: () => void;

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    this.unsub = useRagStore.subscribe((state, prev) => {
      // reduced motion: the EdgeLayer's static active-edge highlight
      // carries the same "data is moving" information
      if (prefersReducedMotion()) return;
      // while scrubbing history, live packet bursts would contradict the view
      if (state.scrubSeq !== null) return;
      for (const edge of PIPELINE_EDGES) {
        const plan = planPackets(edge, prev, state);
        if (plan) this.spawn(plan);
      }
    });
  }

  private spawn(plan: PacketPlan): void {
    const path = this.svg.querySelector<SVGPathElement>(`#rag-edge-${plan.edgeId}`);
    if (!path || typeof path.getTotalLength !== "function") return;
    let len = 0;
    try { len = path.getTotalLength(); } catch { return; }
    if (!len) return;

    const now = performance.now();
    const window = Math.max(
      PACKET_TIMING.minWindowMs,
      Math.min(PACKET_TIMING.maxWindowMs, plan.count * 55),
    );
    for (let i = 0; i < plan.count; i++) {
      const el = document.createElementNS(SVG_NS, "text");
      el.textContent = plan.glyph;
      el.setAttribute("data-packet", plan.edgeId);
      el.setAttribute("font-size", "11");
      el.setAttribute("fill", "#2563EB");
      el.setAttribute("text-anchor", "middle");
      el.setAttribute("dominant-baseline", "central");
      el.setAttribute("transform", "translate(-9999,-9999)");
      el.style.filter = "drop-shadow(0 0 4px rgba(37,99,235,0.55))";
      this.svg.appendChild(el);
      this.packets.push({
        el, path, len,
        start: now + (plan.count === 1 ? 0 : (i / (plan.count - 1)) * window),
        dur: PACKET_TIMING.travelMs,
      });
    }
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    const now = performance.now();
    this.packets = this.packets.filter(p => {
      if (!p.path.isConnected) { p.el.remove(); return false; }
      const t = (now - p.start) / p.dur;
      if (t >= 1) { p.el.remove(); return false; }
      if (t < 0) return true;   // still queued off-screen
      const pt = p.path.getPointAtLength(t * p.len);
      p.el.setAttribute("transform", `translate(${pt.x},${pt.y})`);
      p.el.setAttribute("opacity", String(t < 0.12 ? t / 0.12 : t > 0.85 ? (1 - t) / 0.15 : 1));
      return true;
    });
    this.raf = this.packets.length ? requestAnimationFrame(this.tick) : 0;
  };

  /** Strict lifecycle: unsubscribe, cancel the loop, remove every dot. */
  destroy(): void {
    this.unsub();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.packets.forEach(p => p.el.remove());
    this.packets = [];
  }
}
