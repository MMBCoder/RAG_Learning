"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, BrainCircuit, RotateCcw } from "lucide-react";
import { useRagStore, type SupportLevel } from "../ragStore";
import { citationsInText } from "../lib/stream";
import { fitContext } from "../lib/contextFit";
import { CONCEPTS, type ConceptId } from "../education/concepts";
import { ConceptTrigger } from "../education/ConceptCard";
import { usePersona } from "../education/usePersona";
import { useReducedMotion } from "../motion/reducedMotion";
import SimulationBadge from "./SimulationBadge";
import { T, DEPTH, eyebrow } from "../theme";

/* ═══════════════════════════════════════════════════════════════════
   INSIDE GPT'S BRAIN (F18) — the honest generation theater. Five acts,
   each an OBSERVABLE stage: the briefing arrives, the working set, the
   live token stream, evidence selection, grounded assembly. Live mode
   follows a real generation; replay re-animates the recorded answer
   with zero API calls. Copy rule: describe what enters and leaves the
   model — never what it "thinks".
   ═══════════════════════════════════════════════════════════════════ */

interface Act { id: string; title: string; conceptId: ConceptId; lesson: string; }

export const BRAIN_ACTS: Act[] = [
  { id: "ingestion", title: "the briefing arrives", conceptId: "prompt-construction", lesson: "One package enters: rules, labelled evidence, and the question. This is the model's entire world for this answer." },
  { id: "working-set", title: "the working set", conceptId: "context-window", lesson: "The evidence that physically fit the budget. Anything outside this list does not exist for the model." },
  { id: "stream", title: "the token stream", conceptId: "generation", lesson: "The answer leaves the model one token at a time, in this exact order. That cadence is real — we recorded it." },
  { id: "evidence", title: "evidence selection", conceptId: "citations", lesson: "Citation markers appear IN the stream as the model writes. Watch which chunks get their receipts, and when." },
  { id: "assembly", title: "grounded assembly", conceptId: "grounding", lesson: "The finished sentences, each tagged afterwards by the judge: supported, partial, or unsupported. The theater ends with an audit." },
];

const REPLAY_WPS = 16;   // replayed words per second — readable, honest pacing

export default function BrainOverlay() {
  const open = useRagStore(s => s.brainOpen);
  const close = useRagStore(s => s.setBrainOpen);
  const answer = useRagStore(s => s.answer);
  const generateStatus = useRagStore(s => s.stages.generate.status);
  const promptBlocks = useRagStore(s => s.promptBlocks);
  const results = useRagStore(s => s.results);
  const chunks = useRagStore(s => s.chunks);
  const budget = useRagStore(s => s.params.contextBudget);
  const maxTokens = useRagStore(s => s.params.maxTokens);
  const sentences = useRagStore(s => s.answerSentences);
  const verdicts = useRagStore(s => s.sentenceVerdicts);
  const stats = useRagStore(s => s.brainStats);
  const { showRawData } = usePersona();
  const reduced = useReducedMotion();

  const [act, setAct] = useState(0);
  const live = generateStatus === "running";

  // replay: re-animate the recorded answer locally — zero API calls
  const [replayText, setReplayText] = useState<string | null>(null);
  const replayTimer = useRef(0);
  const startReplay = () => {
    if (!answer) return;
    if (reduced) { setReplayText(answer); return; }   // cuts, not pans
    const words = answer.split(/(\s+)/);
    let i = 0;
    setReplayText("");
    window.clearInterval(replayTimer.current);
    replayTimer.current = window.setInterval(() => {
      i = Math.min(words.length, i + 2);
      setReplayText(words.slice(0, i).join(""));
      if (i >= words.length) window.clearInterval(replayTimer.current);
    }, 1000 / REPLAY_WPS);
  };
  useEffect(() => () => window.clearInterval(replayTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  const meta = BRAIN_ACTS[act];
  const shownText = live ? (answer ?? "") : (replayText ?? answer ?? "");
  const cited = citationsInText(shownText);
  const byId = new Map(chunks.map(c => [c.id, c]));
  const { kept, ctxTokens } = fitContext(results, chunks, budget);
  const ttft = stats?.firstTokenAt && stats.startedAt ? stats.firstTokenAt - stats.startedAt : null;

  const body = () => {
    switch (meta.id) {
      case "ingestion":
        return (
          <div>
            {promptBlocks.map((b, i) => (
              <motion.div
                key={b.label}
                initial={reduced ? false : { x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: reduced ? 0 : i * 0.25, duration: 0.4 }}
                style={{
                  padding: "10px 14px", borderRadius: 10, marginBottom: 8,
                  background: `${b.color}0D`, border: `1px solid ${b.color}66`,
                  fontFamily: T.mono, fontSize: 12.5, color: T.fg,
                }}
              >
                <span style={{ color: b.color, fontWeight: 700 }}>▸</span> {b.label.toLowerCase()} · {b.tokens} tokens
              </motion.div>
            ))}
            {promptBlocks.length === 0 && <Empty>ask a question first — the briefing pack appears here</Empty>}
          </div>
        );
      case "working-set":
        return kept.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {kept.map(id => {
              const c = byId.get(id);
              return (
                <span key={id} style={{
                  padding: "7px 12px", borderRadius: 10,
                  background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.5)",
                  fontFamily: T.mono, fontSize: 11.5, color: T.blue, fontWeight: 600,
                }}>
                  [{id}] p.{c?.page} · {c?.tokens}t
                </span>
              );
            })}
            <p style={{ width: "100%", fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginTop: 6 }}>
              {kept.length} chunks · {ctxTokens} of {budget} budget tokens in the model&apos;s view
            </p>
          </div>
        ) : <Empty>no working set yet</Empty>;
      case "stream":
        return (
          <div>
            {!live && answer && (
              <button onClick={startReplay} data-brain-replay style={{
                display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
                padding: "8px 15px", borderRadius: 10, cursor: "pointer",
                background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.45)",
                fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.violet,
              }}>
                <RotateCcw size={13} /> replay the recorded stream — no API call
              </button>
            )}
            <div style={{
              minHeight: 120, maxHeight: 220, overflowY: "auto", padding: "13px 15px",
              borderRadius: 11, background: "#0F1117", border: "1px solid rgba(124,58,237,0.35)",
              fontFamily: T.mono, fontSize: 13, lineHeight: 1.75, color: "#D6DCE8",
            }}>
              {shownText || <span style={{ color: "#5B6472" }}>{live ? "waiting for the first token…" : "run a question or press replay"}</span>}
              {(live || (replayText !== null && replayText !== answer)) && (
                <motion.span animate={reduced ? undefined : { opacity: [1, 0.2, 1] }} transition={{ duration: 0.9, repeat: Infinity }} style={{ color: T.violet }}>▍</motion.span>
              )}
            </div>
            {showRawData && stats && (
              <p data-brain-stats style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginTop: 8 }}>
                TTFT {ttft !== null ? `${(ttft / 1000).toFixed(2)}s` : "—"} · {stats.deltas} delta frames ·{" "}
                {stats.firstTokenAt !== null && stats.lastDeltaAt !== null && stats.deltas > 1
                  ? `${(stats.deltas / Math.max(0.001, (stats.lastDeltaAt - stats.firstTokenAt) / 1000)).toFixed(0)} frames/s`
                  : "—"} · answer cap {maxTokens} tokens
              </p>
            )}
          </div>
        );
      case "evidence":
        return (
          <div>
            {cited.length === 0 && <Empty>no citation markers in the stream yet</Empty>}
            {cited.map((id, i) => {
              const c = byId.get(id);
              return (
                <motion.div
                  key={id}
                  initial={reduced ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduced ? 0 : i * 0.1 }}
                  style={{
                    padding: "9px 12px", borderRadius: 9, marginBottom: 6,
                    background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.45)",
                    fontFamily: T.mono, fontSize: 11.5, color: T.fgSec,
                  }}
                >
                  <span style={{ color: T.green, fontWeight: 700 }}>#{i + 1} cited → [{id}]</span>
                  {" "}p.{c?.page} — {c?.text.slice(0, 90)}…
                </motion.div>
              );
            })}
          </div>
        );
      case "assembly":
        return sentences.length ? (
          <div>
            {sentences.map((s, i) => {
              const support: SupportLevel | undefined = verdicts?.[i]?.support;
              const color = support === "unsupported" ? T.red : support === "partial" ? T.amber : T.green;
              return (
                <p key={i} style={{
                  fontSize: 13.5, lineHeight: 1.7, color: T.fg, marginBottom: 7,
                  paddingLeft: 10, borderLeft: `3px ${support === "unsupported" ? "dotted" : support === "partial" ? "dashed" : "solid"} ${color}`,
                }}>
                  {s.text} {support && <span style={{ fontFamily: T.mono, fontSize: 10, color }}>({support})</span>}
                </p>
              );
            })}
            {!verdicts && <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted }}>no per-sentence verdicts this run — doc-level scores only</p>}
          </div>
        ) : <Empty>the finished answer assembles here after grounding</Empty>;
    }
  };

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 110, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)",
    }}>
      <motion.div
        role="dialog" aria-label="Inside GPT's brain"
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        style={{
          width: "100%", maxWidth: 680, maxHeight: "88vh", overflowY: "auto",
          background: T.panel, border: `1px solid ${T.borderStrong}`,
          borderRadius: 18, padding: "20px 24px", boxShadow: DEPTH.overlay,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ ...eyebrow, color: T.violet, display: "flex", alignItems: "center", gap: 7 }}>
            <BrainCircuit size={14} /> inside gpt&apos;s brain · act {act + 1} of {BRAIN_ACTS.length}
            {live && <span style={{ color: T.green }}>· LIVE</span>}
          </p>
          <button onClick={() => close(false)} aria-label="Close brain view" style={{ all: "unset", cursor: "pointer", color: T.fgMuted, display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        <SimulationBadge />

        <h3 style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 20, letterSpacing: "-0.02em", color: T.fg, textTransform: "lowercase", margin: "14px 0 4px" }}>
          {meta.title}
        </h3>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: T.fgSec, marginBottom: 4 }}>{meta.lesson}</p>
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted, marginBottom: 14 }}>
          concept: <ConceptTrigger id={meta.conceptId}>{CONCEPTS[meta.conceptId].term}</ConceptTrigger>
        </p>

        <div style={{ marginBottom: 16, minHeight: 130 }}>{body()}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setAct(v => Math.max(0, v - 1))} disabled={act === 0} aria-label="Previous act" style={navBtn}>
            <ChevronLeft size={14} />
          </button>
          <div style={{ display: "flex", gap: 5 }}>
            {BRAIN_ACTS.map((a, i) => (
              <button key={a.id} onClick={() => setAct(i)} aria-label={`Act ${i + 1}: ${a.title}`} style={{
                width: 9, height: 9, borderRadius: "50%", cursor: "pointer", padding: 0,
                background: i === act ? T.violet : "rgba(124,58,237,0.25)", border: "none",
              }} />
            ))}
          </div>
          <button onClick={() => setAct(v => Math.min(BRAIN_ACTS.length - 1, v + 1))} disabled={act === BRAIN_ACTS.length - 1} aria-label="Next act" style={navBtn}>
            <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgMuted }}>{children}</p>;
}

const navBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 9, cursor: "pointer",
  background: T.inset, border: `1px solid ${T.borderStrong}`, color: T.fgSec,
};
