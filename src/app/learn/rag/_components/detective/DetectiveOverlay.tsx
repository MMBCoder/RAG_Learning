"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Fingerprint } from "lucide-react";
import { useRagStore } from "../ragStore";
import { usePipelineView } from "../timeline/usePipelineView";
import { ANATOMY_STEPS } from "../stories/answerAnatomy";
import { CONCEPTS } from "../education/concepts";
import { ConceptTrigger } from "../education/ConceptCard";
import { director } from "../motion/director";
import SentenceEvidence from "./SentenceEvidence";
import { fitContext } from "../lib/contextFit";
import { T, DEPTH, eyebrow } from "../theme";

/* AI Evidence Detective (F5): arc 3 walked backwards — claim →
   evidence → prompt placement → retrieval scores → the page. Every
   step shows REAL data for the chosen sentence; the Director spotlights
   the pipeline stage each step interrogates. Reaching the source step
   completes journey chapter 4. */

const badgeFor = (support: string | undefined) =>
  support === "unsupported"
    ? { text: "unsupported — no receipt found", color: T.red, bg: "rgba(220,38,38,0.07)", border: "rgba(220,38,38,0.45)" }
    : support === "partial"
      ? { text: "partially supported", color: T.amber, bg: "rgba(217,119,6,0.07)", border: "rgba(217,119,6,0.45)" }
      : support === "supported"
        ? { text: "supported by the document", color: T.green, bg: "rgba(5,150,105,0.07)", border: "rgba(5,150,105,0.45)" }
        : { text: "no per-sentence verdict this run", color: T.fgMuted, bg: "rgba(100,116,139,0.07)", border: "rgba(100,116,139,0.4)" };

export default function DetectiveOverlay() {
  const sentenceIdx = useRagStore(s => s.detectiveSentence);
  const close = useRagStore(s => s.closeDetective);
  const markTraced = useRagStore(s => s.markDetectiveTraced);

  const sentences = usePipelineView(s => s.answerSentences);
  const verdicts = usePipelineView(s => s.sentenceVerdicts);
  const chunks = usePipelineView(s => s.chunks);
  const candidates = usePipelineView(s => s.candidates);
  const results = usePipelineView(s => s.results);
  const budget = useRagStore(s => s.params.contextBudget);
  const pdfData = useRagStore(s => s.pdfData);

  const [step, setStep] = useState(0);
  // restart the walk whenever a new sentence is opened (render-time adjustment)
  const [lastIdx, setLastIdx] = useState(sentenceIdx);
  if (sentenceIdx !== lastIdx) {
    setLastIdx(sentenceIdx);
    setStep(0);
  }

  const open = sentenceIdx !== null && sentences[sentenceIdx] !== undefined;

  // the Director aims at each step's stage; source step completes journey ch. 4
  useEffect(() => {
    if (!open) return;
    director.spotlight(ANATOMY_STEPS[step].stage);
    if (ANATOMY_STEPS[step].id === "source") markTraced();
    return () => director.spotlight(null);
  }, [open, step, markTraced]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  const sentence = sentences[sentenceIdx];
  const verdict = verdicts?.[sentenceIdx];
  const evidenceIds = [...new Set([...sentence.citations, ...(verdict?.evidence ?? [])])];
  const byId = new Map(chunks.map(c => [c.id, c]));
  const candById = new Map(candidates.map(c => [c.chunkId, c]));
  const meta = ANATOMY_STEPS[step];
  const badge = badgeFor(verdict?.support);
  const { kept } = fitContext(results, chunks, budget);

  const body = () => {
    switch (meta.id) {
      case "claim":
        return (
          <>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: T.fg, marginBottom: 12 }}>“{sentence.text}”</p>
            <span style={{
              display: "inline-block", padding: "4px 12px", borderRadius: 12, marginBottom: 6,
              background: badge.bg, border: `1px solid ${badge.border}`,
              fontFamily: T.mono, fontSize: 11.5, fontWeight: 600, color: badge.color,
            }}>
              judge: {badge.text}
            </span>
            <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgMuted }}>
              citations: {sentence.citations.length ? sentence.citations.map(c => `[${c}]`).join(" ") : "none"}
            </p>
          </>
        );
      case "evidence":
        if (evidenceIds.length === 0) return <SentenceEvidence sentence={sentence.text} />;
        return (
          <>
            {evidenceIds.map(id => {
              const c = byId.get(id);
              const cand = candById.get(id);
              if (!c) return null;
              return (
                <div key={id} data-detective-evidence={id} style={evidenceCard}>
                  <p style={{ fontFamily: T.mono, fontSize: 11.5, fontWeight: 700, color: T.green, marginBottom: 5 }}>
                    chunk {id} · page {c.page}
                    {cand ? ` · sim ${(cand.semantic * 100).toFixed(0)}%${cand.rerankRank ? ` · re-rank #${cand.rerankRank}` : ""}` : ""}
                  </p>
                  <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgSec, lineHeight: 1.6 }}>{c.text.slice(0, 280)}…</p>
                </div>
              );
            })}
          </>
        );
      case "placement":
        return (
          <>
            {evidenceIds.map(id => {
              const c = byId.get(id);
              const pos = kept.indexOf(id);
              if (!c) return null;
              return (
                <div key={id} style={evidenceCard}>
                  <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgSec, lineHeight: 1.7 }}>
                    <span style={{ color: T.blue, fontWeight: 700 }}>[{id}]</span>{" "}
                    {pos >= 0
                      ? <>slot {pos + 1} of {kept.length} in the context block · {c.tokens} tokens · {Math.round((c.tokens / budget) * 100)}% of the budget</>
                      : <>not in the current packing — it would be evicted at today&apos;s budget of {budget} tokens</>}
                  </p>
                </div>
              );
            })}
          </>
        );
      case "scores": {
        const rows = evidenceIds.map(id => candById.get(id)).filter(Boolean);
        if (rows.length === 0) return <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgMuted }}>no retrieval scores — this sentence cites nothing.</p>;
        return (
          <>
            {rows.map(cand => (
              <div key={cand!.chunkId} style={{ marginBottom: 12 }}>
                <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fg, fontWeight: 700, marginBottom: 5 }}>chunk {cand!.chunkId}</p>
                {([["semantic", cand!.semantic, T.violet], ["keyword", cand!.keyword, T.blue], ["hybrid", cand!.hybrid, T.green]] as const).map(([label, v, color]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, width: 62 }}>{label}</span>
                    <div style={{ flex: 1, height: 6, background: "rgba(15,23,42,0.07)", borderRadius: 3 }}>
                      <div style={{ width: `${Math.min(100, v * 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgSec, width: 34, textAlign: "right" }}>{(v * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            ))}
          </>
        );
      }
      case "source": {
        const first = byId.get(evidenceIds[0] ?? -1);
        if (!first) return <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgMuted }}>no source passage — the trail ends without a page. That absence IS the finding.</p>;
        return (
          <>
            <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgSec, marginBottom: 8 }}>
              page {first.page} · characters {first.start.toLocaleString()}–{(first.start + first.chars).toLocaleString()} of the cleaned document
              {pdfData ? "" : " · (sample document — no PDF pages to render)"}
            </p>
            <div data-detective-source style={evidenceCard}>
              <p style={{ fontFamily: T.mono, fontSize: 12.5, color: T.fg, lineHeight: 1.7 }}>{first.text}</p>
            </div>
          </>
        );
      }
    }
  };

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 110, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)",
    }}>
      <motion.div
        role="dialog" aria-label="Evidence detective"
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        style={{
          width: "100%", maxWidth: 640, maxHeight: "86vh", overflowY: "auto",
          background: T.panel, border: `1px solid ${T.borderStrong}`,
          borderRadius: 18, padding: "22px 24px", boxShadow: DEPTH.overlay,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <p style={{ ...eyebrow, color: T.violet, display: "flex", alignItems: "center", gap: 7 }}>
            <Fingerprint size={13} /> evidence detective · step {step + 1} of {ANATOMY_STEPS.length}
          </p>
          <button onClick={close} aria-label="Close detective" style={{ all: "unset", cursor: "pointer", color: T.fgMuted, display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        <h3 style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 20, letterSpacing: "-0.02em", color: T.fg, textTransform: "lowercase", marginBottom: 4 }}>
          {meta.title}
        </h3>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: T.fgSec, marginBottom: 6 }}>{meta.lesson}</p>
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted, marginBottom: 14 }}>
          concept: <ConceptTrigger id={meta.conceptId}>{CONCEPTS[meta.conceptId].term}</ConceptTrigger>
        </p>

        <div style={{ marginBottom: 16 }}>{body()}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setStep(v => Math.max(0, v - 1))} disabled={step === 0} aria-label="Previous step" style={navBtn}>
            <ChevronLeft size={14} />
          </button>
          <div style={{ display: "flex", gap: 5 }}>
            {ANATOMY_STEPS.map((s, i) => (
              <button key={s.id} onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${s.title}`} style={{
                width: 9, height: 9, borderRadius: "50%", cursor: "pointer", padding: 0,
                background: i === step ? T.violet : "rgba(124,58,237,0.25)", border: "none",
              }} />
            ))}
          </div>
          <button
            onClick={() => setStep(v => Math.min(ANATOMY_STEPS.length - 1, v + 1))}
            disabled={step === ANATOMY_STEPS.length - 1}
            aria-label="Next step" style={navBtn}
          >
            <ChevronRight size={14} />
          </button>
          <div style={{ flex: 1 }} />
          {step === ANATOMY_STEPS.length - 1 && (
            <button onClick={close} style={{
              padding: "8px 16px", borderRadius: 9, cursor: "pointer",
              background: T.grad, border: "none",
              fontFamily: T.disp, fontWeight: 700, fontSize: 12.5, color: "#fff",
            }}>
              case closed
            </button>
          )}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

const evidenceCard: React.CSSProperties = {
  padding: "11px 13px", borderRadius: 10, marginBottom: 8,
  background: T.inset, border: `1px solid ${T.border}`,
};

const navBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 9, cursor: "pointer",
  background: T.inset, border: `1px solid ${T.borderStrong}`, color: T.fgSec,
};
