"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ChevronDown, Wand2 } from "lucide-react";
import { useRagStore, type RagParams } from "../ragStore";
import { coachInsights } from "./insights";
import { rescoreLocal } from "../lib/pipeline";
import { CONCEPTS } from "../education/concepts";
import { ConceptTrigger } from "../education/ConceptCard";
import { T, eyebrow } from "../theme";

/* Smart Coach (F14): an ambient badge, never a nag. Collapsed by
   default; each card quotes the numbers that triggered it and applies
   its fix through the existing param plumbing — and vanishes the moment
   the condition is gone. */

export default function CoachPanel() {
  const stages = useRagStore(s => s.stages);
  const candidates = useRagStore(s => s.candidates);
  const results = useRagStore(s => s.results);
  const params = useRagStore(s => s.params);
  const promptBlocks = useRagStore(s => s.promptBlocks);
  const evalScores = useRagStore(s => s.evalScores);
  const answerSentences = useRagStore(s => s.answerSentences);
  const chunks = useRagStore(s => s.chunks);
  const setParam = useRagStore(s => s.setParam);
  const [open, setOpen] = useState(false);

  const insights = useMemo(
    () => coachInsights({ stages, candidates, results, params, promptBlocks, evalScores, answerSentences, chunks }),
    [stages, candidates, results, params, promptBlocks, evalScores, answerSentences, chunks],
  );

  if (insights.length === 0) return null;

  const apply = (p: Partial<RagParams>) => {
    for (const [k, v] of Object.entries(p)) setParam(k as keyof RagParams, v as RagParams[keyof RagParams]);
    // retrieval params re-score instantly, exactly like moving the slider
    if ("threshold" in p || "topK" in p || "hybridAlpha" in p) rescoreLocal();
  };

  return (
    <div style={{ marginTop: 18 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        data-coach-badge
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 15px",
          borderRadius: 11, cursor: "pointer",
          background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.45)",
          fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.amber,
        }}
      >
        <Lightbulb size={13} /> coach · {insights.length} suggestion{insights.length === 1 ? "" : "s"}
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            {insights.map(ins => (
              <div key={ins.id} data-coach-insight={ins.id} style={{
                marginTop: 8, padding: "11px 14px", borderRadius: 11,
                background: T.panel, border: `1px solid ${T.border}`,
              }}>
                <p style={{ ...eyebrow, fontSize: 9.5, marginBottom: 5, color: ins.severity === 3 ? T.red : ins.severity === 2 ? T.amber : T.fgMuted }}>
                  {"!".repeat(ins.severity)} · <ConceptTrigger id={ins.conceptId}>{CONCEPTS[ins.conceptId].term}</ConceptTrigger>
                </p>
                <p style={{ fontSize: 12.5, lineHeight: 1.6, color: T.fg, marginBottom: ins.apply ? 8 : 0 }}>{ins.text}</p>
                {ins.apply && (
                  <button
                    onClick={() => apply(ins.apply!.params)}
                    data-coach-apply={ins.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 13px",
                      borderRadius: 9, cursor: "pointer",
                      background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.45)",
                      fontFamily: T.mono, fontSize: 11.5, fontWeight: 600, color: T.green,
                    }}
                  >
                    <Wand2 size={12} /> apply: {ins.apply.label}
                  </button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
