"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, Volume2, VolumeX, MonitorPlay, RotateCcw } from "lucide-react";
import { useRagStore } from "../ragStore";
import { STAGE_BY_ID } from "../stages";
import { usePlayController } from "../PlayMode";
import { CONCEPTS, STAGE_CONCEPT } from "../education/concepts";
import { usePersona } from "../education/usePersona";
import { soundStore, useSoundEnabled } from "../audio/sound";
import SummarySlide from "./SummarySlide";
import SimulationBadge from "../brain/SimulationBadge";
import { CINEMA as C, T } from "../theme";

/* ═══════════════════════════════════════════════════════════════════
   PRESENTATION SHELL (Pillar C) — the show. Fullscreen, the ONE
   sanctioned dark context (CINEMA palette), big-type narration driven
   by the same play controller and registry-voiced arcs as Play Mode.

   Hotkeys: Space pause · ←/→ step · ↑/↓ speed · S sound · K kiosk · Esc exit.
   Presenter persona gets a speaker-notes rail (registry talking points).
   Kiosk loop: auto-restart with rotating sample questions + idle reset.
   ═══════════════════════════════════════════════════════════════════ */

const KIOSK_QUESTIONS = [
  "What travel benefits are included with the card?",
  "What is the annual fee and when is it waived?",
  "How do I qualify for the Voyager card?",
];

function kioskDelay(): number {
  try {
    if (typeof window !== "undefined" && window.localStorage.getItem("rag-viz:fast-play")) return 1500;
  } catch { /* storage unavailable */ }
  return 12_000;
}

export default function PresentationShell() {
  const open = useRagStore(s => s.presentationOpen);
  const setOpen = useRagStore(s => s.setPresentationOpen);
  const play = useRagStore(s => s.play);
  const selected = useRagStore(s => s.selected);
  const query = useRagStore(s => s.query);
  const controller = usePlayController();
  // the returned callbacks are useCallback-stable; the OBJECT identity is
  // not — effects depend on the destructured functions to avoid listener
  // re-registration gaps between renders
  const { start, stop, restart, togglePause, skipForward, skipBack, cycleSpeed } = controller;
  const persona = usePersona();
  const soundOn = useSoundEnabled();
  const [kiosk, setKiosk] = useState(false);
  const kioskCountRef = useRef(0);
  const startedRef = useRef(false);
  const idleRef = useRef(0);

  // entering the shell starts the film once; leaving stops it
  useEffect(() => {
    if (!open) { startedRef.current = false; return; }
    if (!startedRef.current) {
      startedRef.current = true;
      document.documentElement.requestFullscreen?.().catch(() => { /* Safari/user denial — fine */ });
      void start();
    }
    return () => {
      stop();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [open, start, stop]);

  // kiosk: auto-restart at the finale with a rotating question
  useEffect(() => {
    if (!open || !kiosk || !play.finale) return;
    const t = setTimeout(() => {
      const q = KIOSK_QUESTIONS[kioskCountRef.current % KIOSK_QUESTIONS.length];
      kioskCountRef.current += 1;
      useRagStore.getState().patch({ query: q });
      restart();
    }, kioskDelay());
    return () => clearTimeout(t);
  }, [open, kiosk, play.finale, restart]);

  // kiosk: idle reset — any interaction defers it
  useEffect(() => {
    if (!open || !kiosk) return;
    const reset = () => { idleRef.current = Date.now(); };
    reset();
    const events = ["pointerdown", "keydown", "pointermove"] as const;
    events.forEach(e => window.addEventListener(e, reset));
    const timer = setInterval(() => {
      if (Date.now() - idleRef.current > 90_000 && !play.active) restart();
    }, 5_000);
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      clearInterval(timer);
    };
  }, [open, kiosk, play.active, restart]);

  const exit = useCallback(() => setOpen(false), [setOpen]);

  // hotkeys with an on-screen legend
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ": e.preventDefault(); togglePause(); break;
        case "ArrowRight": skipForward(); break;
        case "ArrowLeft": skipBack(); break;
        case "ArrowUp": case "ArrowDown": cycleSpeed(); break;
        case "s": case "S": soundStore.toggle(); break;
        case "k": case "K": setKiosk(k => !k); break;
        case "Escape": stop(); exit(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, togglePause, skipForward, skipBack, cycleSpeed, stop, exit]);

  if (!open || typeof document === "undefined") return null;

  const stage = selected ? STAGE_BY_ID[selected] : null;
  const concept = selected ? CONCEPTS[STAGE_CONCEPT[selected]] : null;
  const showNotes = persona.id === "presenter";

  return createPortal(
    <div
      data-presentation-shell
      style={{
        position: "fixed", inset: 0, zIndex: 130, display: "flex", flexDirection: "column",
        background: C.bg, color: C.fg,
      }}
    >
      {/* top chrome (thin) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px" }}>
        <MonitorPlay size={16} color={C.violet} />
        <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.fgMuted }}>
          presentation · {play.step}/{play.totalSteps || 14}
          {kiosk && <span style={{ color: C.amber }}> · kiosk loop</span>}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => soundStore.toggle()} aria-label={soundOn ? "Sound off" : "Sound on"} style={chromeBtn}>
          {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button onClick={() => setKiosk(k => !k)} aria-pressed={kiosk} aria-label="Toggle kiosk loop" style={{ ...chromeBtn, color: kiosk ? C.amber : C.fgMuted }}>
          <RotateCcw size={15} />
        </button>
        <button onClick={togglePause} aria-label={play.paused ? "Resume" : "Pause"} style={chromeBtn}>
          {play.paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <button onClick={exit} aria-label="Exit presentation" style={chromeBtn}>
          <X size={16} />
        </button>
      </div>

      {/* the stage */}
      <div style={{
        flex: 1, minHeight: 0, display: "flex", gap: 24,
        padding: "0 clamp(20px, 6vw, 90px) 24px",
        flexDirection: "row", flexWrap: "wrap", alignContent: "center",
      }}>
        <div style={{ flex: "2 1 480px", minWidth: 0, alignSelf: "center" }}>
          {play.finale ? (
            <div style={{
              background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20,
              padding: "26px 30px", boxShadow: C.overlayShadow, maxHeight: "78vh", overflowY: "auto",
            }}>
              <SummarySlide onExplore={exit} onReplay={restart} />
            </div>
          ) : (
            <>
              <AnimatePresence mode="wait">
                <motion.p
                  key={stage?.id ?? "start"}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    fontFamily: T.mono, fontSize: 14, letterSpacing: "0.16em",
                    textTransform: "uppercase", color: C.violet, marginBottom: 16,
                  }}
                >
                  {stage ? `${stage.title}` : query ? "—" : "the journey of a document"}
                </motion.p>
              </AnimatePresence>
              <p data-presentation-narration style={{
                fontFamily: T.disp, fontWeight: 700, letterSpacing: "-0.02em",
                fontSize: "clamp(24px, 3.2vw, 42px)", lineHeight: 1.35, color: C.fg,
                minHeight: "4.05em",
              }}>
                {play.narration || "Rolling…"}
              </p>
              {/* progress */}
              <div style={{ marginTop: 26, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", maxWidth: 560 }}>
                <motion.div
                  animate={{ width: `${(play.step / (play.totalSteps || 14)) * 100}%` }}
                  style={{ height: "100%", background: C.grad }}
                />
              </div>
            </>
          )}
        </div>

        {/* speaker notes rail — presenter persona, second-window friendly */}
        {showNotes && !play.finale && concept && (
          <aside data-speaker-notes style={{
            flex: "1 1 260px", maxWidth: 360, alignSelf: "center",
            background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: "16px 18px", maxHeight: "70vh", overflowY: "auto",
          }}>
            <p style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: C.fgMuted, marginBottom: 10 }}>
              speaker notes · {concept.term}
            </p>
            <Note label="say" text={concept.plain} />
            <Note label="if asked how" text={concept.technical} />
            <Note label="war story" text={concept.misconfigured} />
            {selected === "generate" && (
              <div style={{ marginTop: 10 }}><SimulationBadge /></div>
            )}
          </aside>
        )}
      </div>

      {/* hotkey legend */}
      <p style={{
        padding: "0 20px 14px", fontFamily: T.mono, fontSize: 10.5,
        color: C.fgMuted, letterSpacing: "0.05em",
      }}>
        space pause · ←/→ step · ↑/↓ speed {play.speed}× · S sound {soundOn ? "on" : "off"} · K kiosk · esc exit
      </p>
    </div>,
    document.body,
  );
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: C.violet, marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: C.fgSec }}>{text}</p>
    </div>
  );
}

const chromeBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 34, height: 34, borderRadius: 9, cursor: "pointer",
  background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, color: C.fgSec,
};
