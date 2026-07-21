"use client";

import { motion } from "framer-motion";
import { useRagStore } from "../ragStore";
import { usePipelineView } from "../timeline/usePipelineView";
import { fitContext } from "../lib/contextFit";
import { ConceptTrigger } from "../education/ConceptCard";
import { useReducedMotion } from "../motion/reducedMotion";
import { T, eyebrow } from "../theme";

/* Context Container (F9): the budget as a physical vessel. Chunks fill
   it bottom-up (`fill` grammar); what doesn't fit sits struck-through
   outside (`overflow`). It re-flows LIVE as the budget slider moves,
   and because it calls the same fitContext() as the prompt stage, the
   vessel is the prompt truth — not an artist's impression. */

const VESSEL_H = 190;

export default function ContextContainer() {
  const candidates = usePipelineView(s => s.candidates);
  const chunks = usePipelineView(s => s.chunks);
  const threshold = useRagStore(s => s.params.threshold);
  const topK = useRagStore(s => s.params.topK);
  const budget = useRagStore(s => s.params.contextBudget);   // LIVE: re-flows on drag
  const reduced = useReducedMotion();

  // reconstruct retrieval's PRE-trim selection (store `results` is already
  // trimmed after a run) so eviction previews correctly in both directions
  const passing = candidates.filter(c => c.hybrid >= threshold);
  const reranked = passing.filter(c => c.rerankRank !== undefined)
    .sort((a, b) => a.rerankRank! - b.rerankRank!);
  const selection = (reranked.length ? reranked : passing).slice(0, topK).map(c => c.chunkId);

  if (selection.length === 0) return null;
  const { kept, dropped, ctxTokens } = fitContext(selection, chunks, budget);
  const byId = new Map(chunks.map(c => [c.id, c]));
  const fillPct = Math.min(1, ctxTokens / (budget || 1));

  return (
    <div>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        {/* the vessel */}
        <div
          role="img"
          aria-label={`Context vessel: ${kept.length} chunks (${ctxTokens} tokens) of a ${budget}-token budget${dropped.length ? `; ${dropped.length} evicted` : ""}`}
          style={{
            width: 120, height: VESSEL_H, position: "relative",
            border: `2px solid ${T.borderStrong}`, borderRadius: "0 0 14px 14px", borderTop: "none",
            background: "linear-gradient(rgba(37,99,235,0.03), rgba(37,99,235,0.06))",
            display: "flex", flexDirection: "column-reverse", overflow: "hidden",
          }}
        >
          {kept.map(id => {
            const c = byId.get(id)!;
            const h = Math.max(10, (c.tokens / (budget || 1)) * VESSEL_H);
            return (
              <motion.div
                key={id}
                data-vessel-chunk={id}
                initial={reduced ? false : { y: -VESSEL_H, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.4, ease: "easeOut" }}
                title={`[${id}] ${c.tokens} tokens`}
                style={{
                  height: h, margin: "1.5px 3px", borderRadius: 5,
                  background: "rgba(37,99,235,0.55)", border: "1px solid rgba(37,99,235,0.7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: T.mono, fontSize: 10, color: "#fff", fontWeight: 700,
                }}
              >
                [{id}]
              </motion.div>
            );
          })}
        </div>

        {/* readout + evicted chunks (overflow grammar) */}
        <div style={{ flex: "1 1 160px" }}>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6 }}>
            <ConceptTrigger id="context-window">the vessel</ConceptTrigger> · {ctxTokens}/{budget} tokens · {Math.round(fillPct * 100)}% full
          </p>
          {dropped.length === 0 ? (
            <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.green }}>
              every retrieved chunk fits ✓
            </p>
          ) : (
            <>
              <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.amber, marginBottom: 6 }}>
                {dropped.length} retrieved chunk{dropped.length === 1 ? "" : "s"} evicted — retrieval “worked”, but the model will never see {dropped.length === 1 ? "it" : "them"}:
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {dropped.map(id => (
                  <span
                    key={id}
                    data-vessel-evicted={id}
                    style={{
                      padding: "4px 10px", borderRadius: 8, textDecoration: "line-through",
                      background: "rgba(217,119,6,0.08)", border: "1px dashed rgba(217,119,6,0.5)",
                      fontFamily: T.mono, fontSize: 11, color: T.amber, fontWeight: 600,
                    }}
                  >
                    [{id}] {byId.get(id)?.tokens ?? "?"}t
                  </span>
                ))}
              </div>
            </>
          )}
          <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginTop: 8, lineHeight: 1.6 }}>
            drag the context budget slider and watch the vessel re-flow — this preview and the real prompt share one packing function
          </p>
        </div>
      </div>
    </div>
  );
}
