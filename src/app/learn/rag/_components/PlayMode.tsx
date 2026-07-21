"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, SkipForward, SkipBack, X, Footprints } from "lucide-react";
import { useRagStore, STAGE_IDS, type StageId } from "./ragStore";
import { STAGE_BY_ID } from "./stages";
import { runIngestion, runQuery, cancelRun, type StageGate } from "./lib/pipeline";
import { SAMPLE_QUESTION } from "./lib/sample";
import { beatIntro, beatPayoff } from "./stories/arcs";
import { director } from "./motion/director";
import { PERSONAS } from "./education/personas";
import SummarySlide from "./presentation/SummarySlide";
import { T, eyebrow } from "./theme";

const S = () => useRagStore.getState();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Narration time per stage at 1×. E2E sets the fast-play flag so the
    full 14-beat film fits in a test budget — same code path, short dwell. */
function baseDwell(): number {
  try {
    if (typeof window !== "undefined" && window.localStorage.getItem("rag-viz:fast-play")) return 350;
  } catch { /* storage unavailable */ }
  return 4200;
}

export function usePlayController() {
  const skipRef = useRef(false);

  /** Wait out the narration dwell, honouring pause / speed / skip / step mode. */
  const dwell = useCallback(async () => {
    const start = performance.now();
    let elapsed = 0;
    while (S().play.active) {
      if (skipRef.current) { skipRef.current = false; return; }
      const p = S().play;
      if (!p.paused) {
        elapsed = performance.now() - start;
        if (elapsed >= baseDwell() / p.speed) return;
      }
      await sleep(120);
    }
  }, []);

  const waitIfPaused = useCallback(async () => {
    while (S().play.active && S().play.paused) {
      if (skipRef.current) { skipRef.current = false; return; }
      await sleep(120);
    }
  }, []);

  /* The gate IS the film: each stage becomes a two-phase beat.
     intro (registry quote, persona voice) → stage runs → payoff (real
     numbers) → dwell. The Director aims the camera; dwell is the clock
     and GSAP follows. */
  const gate: StageGate = {
    before: async (id: StageId) => {
      if (!S().play.active) return;
      S().select(id);
      director.spotlight(id);
      director.flyTo(id);
      const voice = PERSONAS[S().persona].voice;
      S().patch({
        play: { ...S().play, step: STAGE_IDS.indexOf(id) + 1, narration: beatIntro(id, voice) },
      });
      await waitIfPaused();
    },
    after: async (id: StageId) => {
      if (!S().play.active) return;
      S().patch({ play: { ...S().play, narration: beatPayoff(id, S()) } });
      await dwell();
      if (S().play.stepMode) {
        S().patch({ play: { ...S().play, paused: true } });
        await waitIfPaused();
      }
    },
  };

  const start = useCallback(async () => {
    const st = S();
    // decide the source before resetAll clears it
    const source = st.pdfData && st.docName && !st.isSample
      ? { bytes: { data: st.pdfData, name: st.docName } }
      : { sample: true };
    const question = st.query || SAMPLE_QUESTION;

    skipRef.current = false;
    director.fadeChrome(true);
    st.patch({
      play: { active: true, paused: false, step: 0, totalSteps: STAGE_IDS.length, speed: st.play.speed, stepMode: st.play.stepMode, narration: "", finale: false },
    });

    const ok = await runIngestion(source, gate);
    if (ok && S().play.active) await runQuery(question, gate);

    if (S().play.active) {
      // the finale: camera home, spotlight off, recap slide with real numbers
      director.reset();
      director.fadeChrome(false);
      S().patch({ play: { ...S().play, finale: true, narration: "" } });
    } else {
      director.reset();
      director.fadeChrome(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    cancelRun();
    director.reset();
    director.fadeChrome(false);
    S().patch({ play: { ...S().play, active: false, paused: false, finale: false } });
  }, []);

  const restart = useCallback(() => {
    cancelRun();
    S().patch({ play: { ...S().play, active: false, finale: false } });
    setTimeout(() => { void start(); }, 200);
  }, [start]);

  const togglePause = useCallback(() => {
    S().patch({ play: { ...S().play, paused: !S().play.paused } });
  }, []);

  const skipForward = useCallback(() => { skipRef.current = true; }, []);

  const skipBack = useCallback(() => {
    const idx = Math.max(0, S().play.step - 2);
    const id = STAGE_IDS[idx];
    S().select(id);
    director.spotlight(id);
    director.flyTo(id);
    S().patch({ play: { ...S().play, narration: beatPayoff(id, S()) } });
  }, []);

  const cycleSpeed = useCallback(() => {
    const order: (0.5 | 1 | 2)[] = [0.5, 1, 2];
    const next = order[(order.indexOf(S().play.speed) + 1) % order.length];
    S().patch({ play: { ...S().play, speed: next } });
  }, []);

  const toggleStepMode = useCallback(() => {
    S().patch({ play: { ...S().play, stepMode: !S().play.stepMode } });
  }, []);

  return { start, stop, restart, togglePause, skipForward, skipBack, cycleSpeed, toggleStepMode };
}

/* ── overlay UI (narration + transport controls) ──────────── */

const btn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 38, height: 38, borderRadius: 10, cursor: "pointer",
  background: T.inset, border: `1px solid ${T.border}`, color: T.fg,
};

export default function PlayOverlay({
  controller, isMobile,
}: {
  controller: ReturnType<typeof usePlayController>;
  isMobile: boolean;
}) {
  const play = useRagStore(s => s.play);
  const selected = useRagStore(s => s.selected);
  // the presentation shell owns the film (and the Esc key) while open
  const presenting = useRagStore(s => s.presentationOpen);

  // Esc always exits cleanly
  const { stop } = controller;
  useEffect(() => {
    if (!play.active || presenting) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") stop(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play.active, presenting, stop]);

  return (
    <AnimatePresence>
      {play.active && !presenting && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 70,
            display: "flex", justifyContent: "center", padding: isMobile ? "0 10px 12px" : "0 20px 20px",
            pointerEvents: "none",
          }}
        >
          <div style={{
            width: "100%", maxWidth: 800, pointerEvents: "auto",
            background: "rgba(255,255,255,0.97)", border: `1px solid ${T.borderStrong}`,
            borderRadius: 18, padding: isMobile ? "16px 16px 14px" : "18px 24px 16px",
            backdropFilter: "blur(18px)", boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
            maxHeight: "72vh", overflowY: "auto",
          }}>
            {play.finale ? (
              <SummarySlide onExplore={controller.stop} onReplay={controller.restart} />
            ) : (
              <>
                {/* progress */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ ...eyebrow, fontSize: 11, color: T.violet, whiteSpace: "nowrap" }}>
                    play mode · {play.step}/{play.totalSteps}
                  </span>
                  <div style={{ flex: 1, height: 5, background: "rgba(15,23,42,0.08)", borderRadius: 3, overflow: "hidden" }}>
                    <motion.div
                      animate={{ width: `${(play.step / play.totalSteps) * 100}%` }}
                      transition={{ duration: 0.4 }}
                      style={{ height: "100%", background: T.grad, borderRadius: 3 }}
                    />
                  </div>
                  {selected && (
                    <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgSec, whiteSpace: "nowrap" }}>
                      {STAGE_BY_ID[selected].title.toLowerCase()}
                    </span>
                  )}
                </div>

                {/* narration */}
                <p style={{
                  fontSize: isMobile ? 13.5 : 15.5, lineHeight: 1.65, color: T.fg,
                  minHeight: isMobile ? 66 : 52, marginBottom: 14,
                }}>
                  {play.narration || "Starting the pipeline…"}
                </p>

                {/* transport */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={controller.togglePause} style={{ ...btn, background: T.grad, border: "none" }} aria-label={play.paused ? "Resume" : "Pause"}>
                    {play.paused ? <Play size={15} /> : <Pause size={15} />}
                  </button>
                  <button onClick={controller.skipBack} style={btn} aria-label="Skip back"><SkipBack size={14} /></button>
                  <button onClick={controller.skipForward} style={btn} aria-label="Skip forward"><SkipForward size={14} /></button>
                  <button onClick={controller.restart} style={btn} aria-label="Restart"><RotateCcw size={14} /></button>
                  <button
                    onClick={controller.cycleSpeed}
                    style={{ ...btn, width: "auto", padding: "0 14px", fontFamily: T.mono, fontSize: 13, fontWeight: 700 }}
                    aria-label="Playback speed"
                  >
                    {play.speed}×
                  </button>
                  <button
                    onClick={controller.toggleStepMode}
                    style={{
                      ...btn, width: "auto", padding: "0 14px", gap: 6,
                      fontFamily: T.mono, fontSize: 12,
                      background: play.stepMode ? "rgba(124,58,237,0.09)" : btn.background,
                      border: play.stepMode ? "1px solid rgba(124,58,237,0.5)" : btn.border,
                      color: play.stepMode ? T.violet : T.fgSec,
                    }}
                  >
                    <Footprints size={12} /> step
                  </button>
                  <div style={{ flex: 1 }} />
                  <button onClick={controller.stop} style={{ ...btn, color: T.fgSec }} aria-label="Exit play mode"><X size={15} /></button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
