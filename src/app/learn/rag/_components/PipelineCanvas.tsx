"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileUp, ScanText, Eraser, Scissors, Binary, Network, Database,
  MessageCircleQuestion, Radar, ArrowDownWideNarrow, Blocks, Sparkles, Link2, Gauge,
  Check, AlertTriangle, RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRagStore, STAGE_IDS } from "./ragStore";
import type { StageState } from "./ragStore";
import { INGESTION_STAGES, QUERY_STAGES, type StageDef } from "./stages";
import EdgeLayer from "./canvas/EdgeLayer";
import { usePipelineView } from "./timeline/usePipelineView";
import { nodeMotion } from "./motion/grammar";
import { useReducedMotion } from "./motion/reducedMotion";
import { T } from "./theme";

const ICONS: Record<string, LucideIcon> = {
  FileUp, ScanText, Eraser, Scissors, Binary, Network, Database,
  MessageCircleQuestion, Radar, ArrowDownWideNarrow, Blocks, Sparkles, Link2, Gauge,
};

/* ── status dot ───────────────────────────────────────────── */

function StatusBadge({ st }: { st: StageState }) {
  if (st.status === "running") {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        style={{
          width: 16, height: 16, borderRadius: "50%",
          border: "2.5px solid rgba(124,58,237,0.2)", borderTopColor: T.violet,
        }}
      />
    );
  }
  if (st.status === "done") return <Check size={16} color={T.green} strokeWidth={3} />;
  if (st.status === "error") return <AlertTriangle size={15} color={T.red} />;
  if (st.status === "stale") return <RotateCcw size={14} color={T.amber} />;
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.borderStrong }} />;
}

/* ── one node card — states speak the motion grammar ──────── */

function NodeCard({ def, dimmed }: { def: StageDef; dimmed: boolean }) {
  const st = usePipelineView(s => s.stages[def.id]);   // projection-or-live (F2)
  const selected = useRagStore(s => s.selected === def.id);
  const select = useRagStore(s => s.select);
  const spotlight = useRagStore(s => s.spotlightStage);
  const reduced = useReducedMotion();
  const Icon = ICONS[def.icon] ?? Sparkles;
  const running = st.status === "running";
  // recede: play-mode dimming OR the Director's spotlight on another node
  const recede = (dimmed && !running && !selected) || (spotlight !== null && spotlight !== def.id);

  return (
    <motion.button
      layout
      data-stage-id={def.id}
      onClick={() => select(selected ? null : def.id)}
      whileHover={{ y: -3 }}
      // grammar: settle (done) · shake (error) · recede (dimming/spotlight)
      animate={nodeMotion(st.status, recede, reduced)}
      aria-label={`${def.title} — ${st.status}`}
      style={{
        position: "relative", flex: "1 1 0", minWidth: 0,
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
        padding: "14px 14px", textAlign: "left", cursor: "pointer",
        background: selected ? "#F6F2FE" : running ? "#F3F7FF" : T.panel,
        border: `1.5px solid ${selected ? "rgba(124,58,237,0.55)" : running ? "rgba(37,99,235,0.55)" : T.border}`,
        borderRadius: 13,
        boxShadow: running
          ? "0 4px 22px rgba(37,99,235,0.18)"
          : selected ? "0 4px 18px rgba(124,58,237,0.15)" : T.cardShadow,
        transition: "border-color 0.25s, box-shadow 0.25s, background 0.25s",
      }}
    >
      {running && !reduced && (
        // grammar: pulse — "this component is computing"
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{
            position: "absolute", inset: -1.5, borderRadius: 13, pointerEvents: "none",
            border: "1.5px solid rgba(37,99,235,0.55)",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <Icon size={18} color={running ? T.blue : selected ? T.violet : T.fgSec} />
        <StatusBadge st={st} />
      </div>
      <div style={{ minWidth: 0, width: "100%" }}>
        <p style={{
          fontFamily: T.disp, fontWeight: 700, fontSize: 14.5, color: T.fg,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {def.title}
        </p>
        <p style={{
          fontFamily: T.mono, fontSize: 11.5, marginTop: 4, letterSpacing: "0.01em",
          color: st.status === "error" ? T.red : st.status === "stale" ? T.amber : st.note ? T.green : T.fgMuted,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%",
        }}>
          {st.status === "error" ? (st.error ?? "failed") : (st.note ?? def.blurb)}
        </p>
      </div>
      <AnimatePresence>
        {typeof st.ms === "number" && st.status === "done" && (
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "absolute", top: -10, right: 8, padding: "2px 8px",
              background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8,
              fontFamily: T.mono, fontSize: 10.5, color: T.fgSec, boxShadow: T.cardShadow,
            }}
          >
            {st.ms >= 1000 ? `${(st.ms / 1000).toFixed(1)}s` : `${st.ms}ms`}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ── the canvas ───────────────────────────────────────────── */

function Row({ defs, label, isMobile, dimmed }: {
  defs: StageDef[]; label: string; isMobile: boolean; dimmed: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: T.fgMuted }}>
        {label}
      </p>
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: "stretch",
        gap: isMobile ? 26 : 22,   // the gaps ARE the edges — EdgeLayer draws in them
      }}>
        {defs.map(def => (
          <NodeCard key={def.id} def={def} dimmed={dimmed} />
        ))}
      </div>
    </div>
  );
}

export default function PipelineCanvas({ isMobile }: { isMobile: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stages = usePipelineView(s => s.stages);
  const playActive = useRagStore(s => s.play.active);
  const anyRunning = STAGE_IDS.some(id => stages[id].status === "running");
  const dimmed = playActive && anyRunning;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 30 }}>
      {/* measured edges + packet layer sit under the cards */}
      <EdgeLayer containerRef={containerRef} isMobile={isMobile} />
      <Row defs={INGESTION_STAGES} label="① Ingestion — document → vector index" isMobile={isMobile} dimmed={dimmed} />
      <Row defs={QUERY_STAGES} label="② Query — question → grounded answer" isMobile={isMobile} dimmed={dimmed} />
    </div>
  );
}
