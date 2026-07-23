"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Upload, FlaskConical, Play, Download, SlidersHorizontal, BarChart3, ChevronDown, GitCompareArrows, MonitorPlay, HelpCircle, FileDown } from "lucide-react";
import { useRagStore, STAGE_IDS } from "./ragStore";
import { runIngestion } from "./lib/pipeline";
import { ACCEPT_ATTR } from "./lib/parse";
import { useIsMobile } from "../../_components/shared/useIsMobile";
import PipelineCanvas from "./PipelineCanvas";
import Inspector from "./Inspector";
import ParamsPanel from "./ParamsPanel";
import MetricsPanel from "./MetricsPanel";
import AnswerPanel from "./AnswerPanel";
import OutcomeStrip from "./OutcomeStrip";
import PlayOverlay, { usePlayController } from "./PlayMode";
import { PersonaSwitch, PersonaWelcome } from "./education/PersonaPicker";
import MomentToast from "./education/MomentToast";
import { useLearningMoments } from "./education/learningMoments";
import { usePersona } from "./education/usePersona";
import { useJourney, useJourneyDetection } from "./journey/useJourney";
import JourneyChip from "./journey/JourneyChip";
import ChapterCard from "./journey/ChapterCard";
import SoftGate from "./journey/SoftGate";
import TimelineDock from "./timeline/TimelineDock";
import CameraRig from "./canvas/CameraRig";
import DetectiveOverlay from "./detective/DetectiveOverlay";
import BrainOverlay from "./brain/BrainOverlay";
import ChunkProfile from "./heatmap/ChunkProfile";
import Playground from "./playground/Playground";
import LabPanel from "./lab/LabPanel";
import CoachPanel from "./coach/CoachPanel";
import PresentationShell from "./presentation/PresentationShell";
import AccessGate from "./AccessGate";
import HelpOverlay from "./HelpOverlay";
import { initSoundCues } from "./audio/sound";
import { T, eyebrow } from "./theme";

function exportSession() {
  const s = useRagStore.getState();
  const session = {
    exportedAt: new Date().toISOString(),
    document: { name: s.docName, bytes: s.docBytes, pages: s.pages.length, sample: s.isSample },
    params: s.params,
    stages: Object.fromEntries(STAGE_IDS.map(id => [id, { status: s.stages[id].status, ms: s.stages[id].ms, note: s.stages[id].note }])),
    chunks: s.chunks.map(c => ({ id: c.id, page: c.page, chars: c.chars, tokens: c.tokens, overlap: c.overlapChars, preview: c.text.slice(0, 120) })),
    query: s.query || null,
    retrieval: s.candidates.slice(0, 12),
    retrievedChunkIds: s.results,
    promptTokens: s.promptBlocks.map(b => ({ block: b.label, tokens: b.tokens })),
    answer: s.answer,
    evaluation: s.evalScores,
    usage: s.usage,
  };
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rag-session-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const hBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "11px 18px",
  borderRadius: 11, cursor: "pointer", whiteSpace: "nowrap",
  background: T.panel, border: `1px solid ${T.borderStrong}`,
  fontFamily: T.disp, fontWeight: 700, fontSize: 13.5, color: T.fg,
  boxShadow: T.cardShadow,
};

export default function RagShell() {
  const isMobile = useIsMobile(900);   // inspector needs side-by-side room
  const fileRef = useRef<HTMLInputElement>(null);
  const controller = usePlayController();
  const [helpOpen, setHelpOpen] = useState(false);

  const ingested = useRagStore(s => s.ingested);
  const docName = useRagStore(s => s.docName);
  const playActive = useRagStore(s => s.play.active);
  const stages = useRagStore(s => s.stages);
  const tab = useRagStore(s => s.dockTab);
  const setTab = useRagStore(s => s.setDockTab);
  const busy = STAGE_IDS.some(id => stages[id].status === "running");

  const persona = usePersona();
  const execView = persona.isCollapsed("pipeline-canvas");
  const [pipelineOpen, setPipelineOpen] = useState(!execView);
  // collapse/expand default follows the persona (render-time state adjustment)
  const [lastExecView, setLastExecView] = useState(execView);
  if (execView !== lastExecView) {
    setLastExecView(execView);
    setPipelineOpen(!execView);
  }

  // read persisted persona/journey prefs after mount (server HTML must match first paint)
  useEffect(() => {
    useRagStore.getState().hydrateUi();
    useRagStore.getState().hydrateJourney();
    useRagStore.getState().hydrateHistory();
    initSoundCues();
  }, []);

  // the presenter persona lands directly in the demo (once per visit)
  const persona2 = useRagStore(s => s.persona);
  const uiHydrated = useRagStore(s => s.uiHydrated);
  const autoPresentedRef = useRef(false);
  useEffect(() => {
    if (uiHydrated && persona2 === "presenter" && !autoPresentedRef.current) {
      autoPresentedRef.current = true;
      useRagStore.getState().setPresentationOpen(true);
    }
  }, [uiHydrated, persona2]);
  useLearningMoments();
  useJourneyDetection();
  const journey = useJourney();
  const spotlightLoad = journey.enabled && !ingested && journey.current?.spotlight === "load-sample";

  const onFile = (f: File | undefined) => {
    if (f) void runIngestion({ file: f });
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingTop: 78 }}>
      {/* ambient gradients */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(620px 350px at 12% -5%, rgba(37,99,235,0.06), transparent), radial-gradient(720px 420px at 95% 15%, rgba(124,58,237,0.05), transparent)",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1460, margin: "0 auto", padding: isMobile ? "16px 14px 130px" : "22px 28px 130px" }}>

        {/* ── header ── */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ flex: "1 1 340px", minWidth: 0 }}>
            <p style={{ ...eyebrow, marginBottom: 10 }}>
              <Link href="/learn" style={{ color: T.fgMuted, textDecoration: "none" }}>← learn</Link>
              &nbsp;&nbsp;/&nbsp;&nbsp;interactive lab
            </p>
            <h1 style={{
              fontFamily: T.disp, fontWeight: 900, letterSpacing: "-0.045em",
              fontSize: "clamp(1.9rem, 3.8vw, 2.9rem)", textTransform: "lowercase",
              color: T.fg, lineHeight: 1.05,
            }}>
              rag pipeline <span style={T.gradText}>visualizer.</span>
            </h1>
            <p style={{ fontSize: 15, color: T.fgSec, marginTop: 10, maxWidth: 680, lineHeight: 1.65 }}>
              Watch a document become a grounded answer — every stage of a production Retrieval-Augmented
              Generation pipeline, live, inspectable, and tunable. {docName ? "" : "Load the sample guide or your own file — PDF, Word, Excel, Markdown, or image (≤ 10 MB) — to begin."}
            </p>
          </div>

          <div data-rag-chrome style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <JourneyChip />
            <PersonaSwitch />
            <input
              ref={fileRef} type="file" accept={ACCEPT_ATTR} hidden
              onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }}
            />
            <button style={hBtn} disabled={busy || playActive} onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> upload file
            </button>
            {/* chapter 1's gentle spotlight: a breathing ring, never a blocker */}
            <motion.button
              style={hBtn} disabled={busy || playActive}
              onClick={() => void runIngestion({ sample: true })}
              animate={spotlightLoad
                ? { boxShadow: [`${T.cardShadow}, 0 0 0 0px rgba(5,150,105,0.45)`, `${T.cardShadow}, 0 0 0 10px rgba(5,150,105,0)`] }
                : { boxShadow: `${T.cardShadow}, 0 0 0 0px rgba(5,150,105,0)` }}
              transition={spotlightLoad ? { duration: 1.6, repeat: Infinity, ease: "easeOut" } : { duration: 0.2 }}
            >
              <FlaskConical size={15} /> load sample
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              disabled={playActive}
              onClick={() => void controller.start()}
              style={{
                ...hBtn, background: T.grad, border: "none", color: "#fff",
                boxShadow: "0 8px 26px rgba(79,70,229,0.35)",
                opacity: playActive ? 0.5 : 1,
              }}
            >
              <Play size={15} fill="#fff" /> play mode
            </motion.button>
            <button
              style={hBtn}
              disabled={playActive}
              onClick={() => useRagStore.getState().setPresentationOpen(true)}
              aria-label="Enter presentation mode"
            >
              <MonitorPlay size={15} /> present
            </button>
            {ingested && (
              <button style={hBtn} onClick={exportSession} aria-label="Export session as JSON">
                <Download size={15} />
              </button>
            )}
            <button style={hBtn} onClick={() => setHelpOpen(true)} aria-label="How to use this lab">
              <HelpCircle size={15} /> help
            </button>
            <a
              href="/rag-field-guide.pdf" download="rag-field-guide.pdf"
              style={{ ...hBtn, textDecoration: "none" }}
              aria-label="Download the field guide as PDF"
              title="Download the field guide (PDF) to use side by side with the app"
            >
              <FileDown size={15} />
            </a>
          </div>
        </div>

        {/* ── doc status strip ── */}
        {docName && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 20,
              padding: "9px 16px", borderRadius: 20,
              background: ingested ? "rgba(5,150,105,0.07)" : "rgba(37,99,235,0.06)",
              border: `1px solid ${ingested ? "rgba(5,150,105,0.4)" : "rgba(37,99,235,0.4)"}`,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: ingested ? T.green : T.blue,
              boxShadow: `0 0 8px ${ingested ? T.green : T.blue}`,
            }} />
            <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.fgSec, fontWeight: 600 }}>
              {docName} · {ingested ? "ingested — ask anything" : busy ? "processing…" : "waiting"}
            </span>
          </motion.div>
        )}

        {/* ── executive outcome view ── */}
        {execView && <OutcomeStrip />}

        {/* ── pipeline + inspector ── */}
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{
              padding: isMobile ? "18px 14px" : "24px 22px",
              background: "#FAFBFC", border: `1px solid ${T.border}`, borderRadius: 18,
            }}>
              {execView && (
                <button
                  onClick={() => setPipelineOpen(o => !o)}
                  aria-expanded={pipelineOpen}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                    background: "transparent", border: "none", padding: 0,
                    fontFamily: T.mono, fontSize: 12.5, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: T.fgSec, fontWeight: 600,
                    marginBottom: pipelineOpen ? 18 : 0,
                  }}
                >
                  <ChevronDown size={14} style={{ transform: pipelineOpen ? "none" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                  how it works — the 14-step pipeline
                </button>
              )}
              {(!execView || pipelineOpen) && (
                <>
                  <CameraRig>
                    <PipelineCanvas isMobile={isMobile} />
                  </CameraRig>
                  <TimelineDock />
                </>
              )}
            </div>

            <AnswerPanel isMobile={isMobile} />

            {/* ── dock: parameters / metrics (journey soft-gates it until
                   the tune-a-parameter chapter — folded, never locked) ── */}
            <div data-rag-chrome>
            <SoftGate chapterId="tune-and-ask" surface="parameters & metrics">
            <div id="rag-dock" style={{
              background: T.panel, border: `1px solid ${T.border}`, borderRadius: 18,
              padding: isMobile ? "16px 16px 20px" : "20px 24px 26px",
              boxShadow: T.cardShadow,
            }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
                {([
                  ["params", "parameters", SlidersHorizontal],
                  ["metrics", "metrics", BarChart3],
                  ["playground", "a/b playground", GitCompareArrows],
                  ["lab", "ai lab", FlaskConical],
                ] as const)
                  .filter(([key]) => !(key === "lab" && persona.isHidden("lab")))
                  .map(([key, label, Icon]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
                        borderRadius: 10, cursor: "pointer",
                        background: tab === key ? "rgba(124,58,237,0.07)" : "transparent",
                        border: `1px solid ${tab === key ? "rgba(124,58,237,0.45)" : T.border}`,
                        fontFamily: T.mono, fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase",
                        color: tab === key ? T.violet : T.fgSec, fontWeight: 600,
                      }}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
              </div>
              {tab === "params" ? <ParamsPanel />
                : tab === "metrics" ? <MetricsPanel />
                : tab === "playground" ? <Playground />
                : <LabPanel />}
              <CoachPanel />
            </div>
            </SoftGate>
            </div>
          </div>

          {!isMobile && <Inspector isMobile={false} />}
        </div>
      </div>

      {isMobile && <Inspector isMobile />}
      <PlayOverlay controller={controller} isMobile={isMobile} />
      <MomentToast isMobile={isMobile} />
      <ChapterCard isMobile={isMobile} />
      <DetectiveOverlay />
      <BrainOverlay />
      <ChunkProfile />
      <PresentationShell />
      <AccessGate />
      <PersonaWelcome />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
