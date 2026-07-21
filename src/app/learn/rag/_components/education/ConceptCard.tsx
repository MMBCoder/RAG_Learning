"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, SlidersHorizontal, FlaskConical, X, Sparkles } from "lucide-react";
import { CONCEPTS, EXPERIMENT_LABELS, CONFIDENCE_LABELS, type ConceptId, type ConfidenceLevel } from "./concepts";
import { composeConcept } from "./compose";
import { usePersona } from "./usePersona";
import { useRagStore, type RagParams } from "../ragStore";
import { T, DEPTH, eyebrow } from "../theme";

/* ── shared card body (popover + embedded block use the same content) ── */

const PARAM_LABELS: Record<keyof RagParams, string> = {
  chunkSize: "chunk size", chunkOverlap: "chunk overlap", topK: "top-K",
  threshold: "similarity threshold", hybridAlpha: "hybrid blend α",
  useRerank: "re-ranking", temperature: "temperature", maxTokens: "max tokens",
  contextBudget: "context budget", systemPrompt: "system prompt",
};

function CardBody({ id, onNavigate }: { id: ConceptId; onNavigate?: () => void }) {
  const { voice } = usePersona();
  const setDockTab = useRagStore(s => s.setDockTab);
  const pulseParam = useRagStore(s => s.pulseParam);
  const c = CONCEPTS[id];
  const composed = composeConcept(c, voice);

  const jumpToParam = (k: keyof RagParams) => {
    // a deep link must always land somewhere visible — lift the journey's
    // soft gate on the dock before jumping
    useRagStore.getState().openJourneyGate("tune-and-ask");
    setDockTab("params");
    pulseParam(k);
    // the gated dock mounts on the next frame; scroll after it exists
    requestAnimationFrame(() => {
      document.getElementById("rag-dock")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    onNavigate?.();
  };

  return (
    <div>
      {c.confidence && <ConfidenceBadge level={c.confidence} />}

      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: T.fg, marginBottom: 12 }}>{composed.lead}</p>

      {composed.sections.map(s => (
        <div key={s.label} style={{ marginBottom: 10 }}>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 3, color: T.violet }}>{s.label}</p>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: T.fgSec }}>{s.text}</p>
        </div>
      ))}

      {c.history && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 3, color: T.violet }}>where it came from</p>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: T.fgSec }}>{c.history}</p>
        </div>
      )}

      {c.params.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6 }}>adjust it</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {c.params.map(k => (
              <button
                key={k}
                onClick={() => jumpToParam(k)}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                  borderRadius: 14, cursor: "pointer",
                  background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.35)",
                  fontFamily: T.mono, fontSize: 11.5, color: T.blue,
                }}
              >
                <SlidersHorizontal size={11} /> {PARAM_LABELS[k]} →
              </button>
            ))}
          </div>
        </div>
      )}

      {c.experiments.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6 }}>try in the ai lab</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {c.experiments.map(e => (
              <span key={e} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                borderRadius: 14,
                background: "rgba(124,58,237,0.05)", border: "1px dashed rgba(124,58,237,0.4)",
                fontFamily: T.mono, fontSize: 11.5, color: T.violet,
              }}>
                <FlaskConical size={11} /> {EXPERIMENT_LABELS[e]}
              </span>
            ))}
          </div>
        </div>
      )}

      {c.tryThis && (
        <div style={{
          marginTop: 12, padding: "10px 12px", borderRadius: 10,
          background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.35)",
        }}>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 4, color: T.green, display: "flex", alignItems: "center", gap: 5 }}>
            <Sparkles size={11} /> try this now
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: T.fgSec }}>{c.tryThis}</p>
        </div>
      )}

      {c.related.length > 0 && (
        <p style={{ marginTop: 12, fontFamily: T.mono, fontSize: 11, color: T.fgMuted, lineHeight: 1.7 }}>
          related: {c.related.map(r => CONCEPTS[r].term).join(" · ")}
        </p>
      )}
    </div>
  );
}

/* Confidence badge — tells learners how settled this knowledge is:
   textbook fact, converging practice, or open research question. */
const CONFIDENCE_TINT: Record<ConfidenceLevel, { fg: string; bg: string; border: string }> = {
  established: { fg: T.green, bg: "rgba(5,150,105,0.07)", border: "rgba(5,150,105,0.35)" },
  evolving: { fg: T.blue, bg: "rgba(37,99,235,0.06)", border: "rgba(37,99,235,0.35)" },
  debated: { fg: T.amber, bg: "rgba(217,119,6,0.07)", border: "rgba(217,119,6,0.4)" },
};

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const tint = CONFIDENCE_TINT[level];
  return (
    <span style={{
      display: "inline-block", marginBottom: 10, padding: "3px 9px", borderRadius: 11,
      background: tint.bg, border: `1px solid ${tint.border}`,
      fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em",
      textTransform: "uppercase", color: tint.fg, fontWeight: 600,
    }}>
      {CONFIDENCE_LABELS[level]}
    </span>
  );
}

/* ── inline trigger + popover ─────────────────────────────── */

const CARD_W = 340;

export function ConceptTrigger({ id, children }: { id: ConceptId; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const c = CONCEPTS[id];

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - CARD_W - 16));
    const below = r.bottom + 10;
    const top = below + 320 > window.innerHeight ? Math.max(12, r.top - 330) : below;
    setPos({ left, top });
  }, []);

  const toggle = () => {
    if (!open) place();
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (cardRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Explain: ${c.term}`}
        style={{
          all: "unset", cursor: "help",
          borderBottom: `1.5px dotted ${open ? T.violet : "rgba(124,58,237,0.45)"}`,
          color: "inherit", font: "inherit",
        }}
      >
        {children}
      </button>
      <AnimatePresence>
        {open && pos && (
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-label={c.term}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed", left: pos.left, top: pos.top, width: CARD_W, zIndex: 90,
              maxHeight: 440, overflowY: "auto",
              background: T.panel, border: `1px solid ${T.borderStrong}`,
              borderRadius: 14, padding: "16px 18px",
              boxShadow: `${DEPTH.floating}, ${DEPTH.innerHighlight}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ ...eyebrow, fontSize: 10.5, color: T.violet, display: "flex", alignItems: "center", gap: 6 }}>
                <GraduationCap size={12} /> concept
              </p>
              <button onClick={() => setOpen(false)} aria-label="Close concept card"
                style={{ all: "unset", cursor: "pointer", color: T.fgMuted, display: "flex" }}>
                <X size={14} />
              </button>
            </div>
            <h4 style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 17, color: T.fg, letterSpacing: "-0.02em", marginBottom: 8 }}>
              {c.term}
            </h4>
            <CardBody id={id} onNavigate={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── embedded block (Inspector) — always visible, persona-voiced ── */

export function ConceptBlock({ id }: { id: ConceptId }) {
  const c = CONCEPTS[id];
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12, marginBottom: 18,
      background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.22)",
    }}>
      <p style={{ ...eyebrow, fontSize: 10.5, color: T.violet, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <GraduationCap size={12} /> concept · {c.term}
      </p>
      <CardBody id={id} />
    </div>
  );
}
