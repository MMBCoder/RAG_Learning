"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  X, HelpCircle, Rocket, Workflow, SlidersHorizontal, Layers,
  Compass, Keyboard, FileDown,
} from "lucide-react";
import { T, DEPTH, eyebrow } from "./theme";

/* In-app "how to use this lab" guide. Opened from the Help button in the
   header. Content mirrors the printed field guide: quick start, the 14-stage
   pipeline, the controls, every instrument, the guided journey, and the
   parameter cheat sheet — native to the app's light editorial theme. */

const PHASES: { k: string; t: string; stages: [string, string][] }[] = [
  {
    k: "A", t: "Ingest & index",
    stages: [
      ["upload", "your file enters — PDF, Word, Excel, Markdown or image"],
      ["parse", "text extracted page by page (all sheets/pages)"],
      ["clean", "whitespace and noise normalized"],
      ["chunk", "split into passages by your size + overlap dials"],
      ["tokenize", "each chunk measured in model tokens"],
      ["embed", "each chunk → a 768-dim Gemini vector"],
      ["index", "vectors stored + projected to 3D (PCA) — the memory"],
    ],
  },
  {
    k: "B", t: "Retrieve",
    stages: [
      ["query", "your question is embedded the same way as chunks"],
      ["retrieve", "index scored — hybrid semantic + keyword match"],
      ["rerank", "top passages reordered by true relevance"],
    ],
  },
  {
    k: "C", t: "Generate",
    stages: [
      ["prompt", "system rules + retrieved context + question assembled"],
      ["generate", "model streams the answer one token at a time"],
    ],
  },
  {
    k: "D", t: "Verify",
    stages: [
      ["ground", "every sentence linked back to its citation"],
      ["evaluate", "per-sentence verdicts flag unsupported claims"],
    ],
  },
];

const CONTROLS: [string, string][] = [
  ["persona", "pick Student, AI Engineer, Researcher, Executive or Presenter — the UI adapts its depth and language"],
  ["journey", "turn on the 8-chapter guided path; it spotlights the next thing to do"],
  ["upload / load sample", "bring your own file (≤ 10 MB) or use the built-in sample guide"],
  ["play mode", "a narrated, cinematic run of the whole pipeline"],
  ["present", "fullscreen demo view with speaker notes"],
  ["export", "download the whole session — params, chunks, retrieval, answer, scores — as JSON"],
];

const INSTRUMENTS: [string, string][] = [
  ["Inspector (right panel)", "click any node to see its real artifacts — pages, chunks, tokens, a live vector sample, retrieval scores, the assembled prompt"],
  ["Embedding Universe (3D)", "every chunk plotted in space by meaning; a PCA projection of the real 768-dim vectors, with clusters labeled"],
  ["Timeline", "scrub the recorded run backward and forward, stage by stage"],
  ["Parameters", "the dials that decide quality (see the cheat sheet below)"],
  ["Metrics", "cost meter, latency distribution, and an evaluation radar of answer quality"],
  ["A/B Playground", "run the same question under two configs side by side and get a verdict"],
  ["AI Lab", "hypothesis-first experiments; run a sabotage preset to break retrieval on purpose and diagnose it"],
  ["Coach", "contextual insights that appear as you work, tuned to your persona"],
  ["Detective (trace)", "pick one sentence and follow its citation back to the exact chunk and page"],
  ["Brain / Generation Theater", "watch the model in four acts — briefing → working set → token stream → live citations"],
  ["Chunk Profile", "a per-chunk close-up: size, tokens, overlap, and how strongly it scored"],
  ["Prompt MRI", "dissect the exact prompt — system rules, context, question — with each block's token budget"],
];

const JOURNEY: [string, string][] = [
  ["Ingest a document", "watch a file become clean text → chunks → vectors in seconds"],
  ["Ask your first question", "your question becomes a vector; the index finds evidence; the model answers from it"],
  ["Open a pipeline node", "prove nothing is a black box — every stage shows its real artifacts"],
  ["Trace an answer to its source", "follow one sentence back through its citation to the exact passage and page"],
  ["Tune a parameter & re-ask", "move one dial, ask again, watch retrieval, prompt and answer respond"],
  ["Break it on purpose", "run a sabotage preset and diagnose the damage in the metrics"],
  ["Compare two configurations", "run the same question two ways; let the evaluation scores decide"],
  ["Present it to someone", "the final test of understanding — narrate the pipeline to a friend or a room"],
];

const PARAMS: [string, string, string][] = [
  ["chunk size", "600", "characters per passage before splitting — bigger means more context each, coarser retrieval"],
  ["chunk overlap", "80", "characters shared between neighbours — higher keeps sentences whole at boundaries"],
  ["top-K", "4", "how many chunks are retrieved per question — more is richer but noisier and pricier"],
  ["threshold", "0.25", "minimum similarity a chunk needs to qualify — stricter returns fewer, closer matches"],
  ["hybrid α", "0.70", "blend of semantic meaning vs keyword match — higher leans on meaning"],
  ["rerank", "on", "reorders retrieved chunks by true relevance — better order, a little more latency"],
  ["temperature", "1.0", "randomness of the answer — higher is more varied but drifts from evidence"],
  ["max tokens", "600", "length cap on the answer"],
  ["context budget", "2000", "token ceiling for retrieved context in the prompt — higher fits more evidence"],
  ["system prompt", "edit", "the rules the model must obey (cite every claim, refuse if the answer is absent)"],
];

export default function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 120, display: "flex",
        alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px",
        background: "rgba(15,23,42,0.42)", backdropFilter: "blur(3px)",
      }}
    >
      <motion.div
        role="dialog" aria-label="How to use this lab" aria-modal="true"
        onClick={e => e.stopPropagation()}
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        style={{
          width: "100%", maxWidth: 780, maxHeight: "90vh", overflowY: "auto",
          background: T.panel, border: `1px solid ${T.borderStrong}`,
          borderRadius: 18, padding: "26px 28px 30px", boxShadow: DEPTH.overlay,
        }}
      >
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <p style={{ ...eyebrow, color: T.blue, display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <HelpCircle size={13} /> field guide
            </p>
            <h2 style={{ fontFamily: T.disp, fontWeight: 900, fontSize: "clamp(1.4rem, 3vw, 1.9rem)", letterSpacing: "-0.03em", color: T.fg, lineHeight: 1.05 }}>
              how to use this lab
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a
              href="/rag-field-guide.pdf" download="rag-field-guide.pdf"
              aria-label="Download this guide as a PDF"
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 15px",
                borderRadius: 10, textDecoration: "none", whiteSpace: "nowrap",
                background: T.grad, color: "#fff", fontFamily: T.disp, fontWeight: 700, fontSize: 13,
                boxShadow: "0 6px 18px rgba(79,70,229,0.28)",
              }}
            >
              <FileDown size={15} /> download PDF
            </a>
            <button onClick={onClose} aria-label="Close help" style={{ all: "unset", cursor: "pointer", color: T.fgMuted, display: "flex", padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>
        <p style={{ fontSize: 14, color: T.fgSec, lineHeight: 1.6, maxWidth: "62ch", marginTop: 8, marginBottom: 4 }}>
          A document enters on the left and leaves as a grounded, cited answer on the right. Everything here is
          inspectable — open, tune, break, and replay any stage. Here&apos;s the whole lab, and the order to learn it in.
        </p>

        {/* quick start */}
        <Section icon={<Rocket size={13} />} title="Quick start">
          <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 9 }}>
            <li style={liStyle}><b style={bStyle}>Load a document.</b> Click <Kbd>load sample</Kbd> to start instantly, or <Kbd>upload file</Kbd> for your own (≤ 10 MB — PDF, Word, Excel, Markdown, image). The top row lights up as it builds memory.</li>
            <li style={liStyle}><b style={bStyle}>Ask a question.</b> Type it into the answer panel. Your question is embedded, the closest passages are retrieved, and the model answers from that evidence — with citations.</li>
            <li style={liStyle}><b style={bStyle}>Explore.</b> Click any node in the pipeline to open the Inspector and see the real data that stage produced.</li>
          </ol>
        </Section>

        {/* pipeline */}
        <Section icon={<Workflow size={13} />} title="The pipeline — 14 stages, left to right">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
            {PHASES.map(p => (
              <div key={p.k} style={{ border: `1px solid ${T.border}`, borderRadius: 12, background: T.inset, overflow: "hidden" }}>
                <div style={{ padding: "9px 13px", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: T.blue }}>Phase {p.k}</span>
                  <span style={{ fontFamily: T.disp, fontWeight: 800, fontSize: 14, color: T.fg, marginLeft: 8 }}>{p.t}</span>
                </div>
                {p.stages.map(([name, desc]) => (
                  <div key={name} style={{ display: "flex", gap: 9, padding: "8px 13px", borderTop: `1px solid ${T.border}` }}>
                    <span style={{ fontFamily: T.mono, fontSize: 11.5, fontWeight: 700, color: T.violet, flexShrink: 0, minWidth: 62 }}>{name}</span>
                    <span style={{ fontSize: 11.5, color: T.fgSec, lineHeight: 1.4 }}>{desc}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>

        {/* controls */}
        <Section icon={<Compass size={13} />} title="Header controls — where you drive from">
          <DefList rows={CONTROLS} keyColor={T.blue} />
        </Section>

        {/* instruments */}
        <Section icon={<Layers size={13} />} title="The instruments — every panel">
          <DefList rows={INSTRUMENTS} keyColor={T.violet} />
        </Section>

        {/* journey */}
        <Section icon={<Compass size={13} />} title="Guided journey — do these in order">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 8 }}>
            {JOURNEY.map(([t, d], i) => (
              <div key={t} style={{ display: "flex", gap: 11, padding: "9px 12px", background: T.inset, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <span style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 13, color: T.blue, flexShrink: 0 }}>{i + 1}</span>
                <div>
                  <div style={{ fontFamily: T.disp, fontWeight: 700, fontSize: 13, color: T.fg }}>{t}</div>
                  <div style={{ fontSize: 11.5, color: T.fgSec, lineHeight: 1.4, marginTop: 2 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* params */}
        <Section icon={<SlidersHorizontal size={13} />} title="Parameter cheat sheet — the dials (defaults shown)">
          <div style={{ display: "flex", flexDirection: "column", gap: 0, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            {PARAMS.map(([name, def, desc], i) => (
              <div key={name} style={{
                display: "flex", gap: 12, alignItems: "baseline", padding: "9px 14px",
                borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
                background: i % 2 ? T.inset : T.panel,
              }}>
                <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.fg, minWidth: 108, flexShrink: 0 }}>{name}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.amber, minWidth: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{def}</span>
                <span style={{ fontSize: 11.5, color: T.fgSec, lineHeight: 1.45 }}>{desc}</span>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, fontFamily: T.mono, fontSize: 11.5, color: T.fgMuted }}>
          <Keyboard size={14} /> Press <Kbd>Esc</Kbd> or click outside to close. Tip: <b style={{ color: T.fg }}>download the PDF</b> and keep it open beside the app. Every model call runs on Google Gemini.
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

const liStyle: React.CSSProperties = { fontSize: 13, color: T.fgSec, lineHeight: 1.55 };
const bStyle: React.CSSProperties = { fontFamily: T.disp, color: T.fg, fontWeight: 700 };

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <p style={{ ...eyebrow, fontSize: 11, color: T.fg, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ color: T.blue, display: "flex" }}>{icon}</span>{title}
      </p>
      {children}
    </div>
  );
}

function DefList({ rows, keyColor }: { rows: [string, string][]; keyColor: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: keyColor, minWidth: 150, flexShrink: 0 }}>{k}</span>
          <span style={{ fontSize: 12.5, color: T.fgSec, lineHeight: 1.45, flex: "1 1 300px" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: T.mono, fontSize: 11.5, fontWeight: 600, color: T.fg,
      background: T.inset, border: `1px solid ${T.borderStrong}`, borderRadius: 6,
      padding: "1px 7px", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}
