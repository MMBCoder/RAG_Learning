"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, BookOpenText } from "lucide-react";
import { useRagStore } from "../ragStore";
import { usePipelineView } from "../timeline/usePipelineView";
import { chunkHistories } from "../lib/history";
import { ConceptTrigger } from "../education/ConceptCard";
import { T, DEPTH, eyebrow } from "../theme";

/* Chunk Life Story (F6): one passage's biography across every question
   asked this session — similarity sparkline, retrieved/cited counters,
   and a per-question lifecycle strip. All from the event log. */

export default function ChunkProfile() {
  const id = useRagStore(s => s.profileChunk);
  const close = useRagStore(s => s.closeChunkProfile);
  const events = useRagStore(s => s.events);
  const chunks = usePipelineView(s => s.chunks);

  useEffect(() => {
    if (id === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, close]);

  if (id === null || typeof document === "undefined") return null;
  const chunk = chunks.find(c => c.id === id);
  if (!chunk) return null;

  const history = chunkHistories(events).get(id);
  const records = history?.records ?? [];
  const sims = records.map(r => r.sim ?? 0);
  const maxSim = Math.max(...sims, 0.01);

  // sparkline geometry
  const W = 260, H = 56;
  const points = sims.map((s, i) => {
    const x = sims.length === 1 ? W / 2 : (i / (sims.length - 1)) * W;
    return `${x.toFixed(1)},${(H - (s / maxSim) * (H - 6) - 3).toFixed(1)}`;
  }).join(" ");

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 110, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgba(15,23,42,0.4)", backdropFilter: "blur(3px)",
    }}>
      <motion.div
        role="dialog" aria-label={`Chunk ${id} life story`}
        initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        style={{
          width: "100%", maxWidth: 520, maxHeight: "84vh", overflowY: "auto",
          background: T.panel, border: `1px solid ${T.borderStrong}`,
          borderRadius: 16, padding: "20px 22px", boxShadow: DEPTH.overlay,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ ...eyebrow, color: T.blue, display: "flex", alignItems: "center", gap: 7 }}>
            <BookOpenText size={13} /> chunk life story
          </p>
          <button onClick={close} aria-label="Close chunk profile" style={{ all: "unset", cursor: "pointer", color: T.fgMuted, display: "flex" }}>
            <X size={15} />
          </button>
        </div>

        <h3 style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 19, color: T.fg, letterSpacing: "-0.02em", marginBottom: 4 }}>
          chunk {id} · page {chunk.page}
        </h3>
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted, marginBottom: 12 }}>
          {chunk.chars} chars · {chunk.tokens} tokens{chunk.overlapChars > 0 ? ` · ${chunk.overlapChars} overlap` : ""}
        </p>

        <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgSec, lineHeight: 1.6, marginBottom: 14, padding: "10px 12px", background: T.inset, borderRadius: 10, border: `1px solid ${T.border}` }}>
          {chunk.text.slice(0, 220)}…
        </p>

        {records.length === 0 ? (
          <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgMuted }}>
            no questions asked yet — this passage&apos;s story starts with your first query
          </p>
        ) : (
          <>
            <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6 }}>
              <ConceptTrigger id="cosine-similarity">similarity across your {records.length} question{records.length === 1 ? "" : "s"}</ConceptTrigger>
            </p>
            <svg width={W} height={H} style={{ display: "block", marginBottom: 4 }} role="img"
              aria-label={`Similarity sparkline over ${records.length} questions`}>
              <polyline points={points} fill="none" stroke={T.blue} strokeWidth={2} strokeLinejoin="round" />
              {records.map((r, i) => {
                const x = sims.length === 1 ? W / 2 : (i / (sims.length - 1)) * W;
                const y = H - ((r.sim ?? 0) / maxSim) * (H - 6) - 3;
                return <circle key={i} cx={x} cy={y} r={3.5}
                  fill={r.cited ? T.green : r.retrieved ? T.blue : "rgba(148,163,184,0.7)"} />;
              })}
            </svg>
            <p style={{ fontFamily: T.mono, fontSize: 10, color: T.fgMuted, marginBottom: 12 }}>
              ● cited · ● retrieved · ● passed over — heights are real similarity scores
            </p>

            <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
              <Stat label="retrieved" value={`${history!.retrievedCount}/${records.length}`} color={T.blue} />
              <Stat label="cited in answers" value={`${history!.citedCount}/${records.length}`} color={T.green} />
              <Stat label="best sim" value={`${(maxSim * 100).toFixed(0)}%`} color={T.violet} />
            </div>

            <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6 }}>lifecycle</p>
            {records.map((r, i) => (
              <div key={i} data-lifecycle-row style={{
                display: "flex", gap: 8, alignItems: "baseline", padding: "5px 0",
                borderBottom: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11,
              }}>
                <span style={{ color: r.cited ? T.green : r.retrieved ? T.blue : T.fgMuted, fontWeight: 700, flexShrink: 0 }}>
                  {r.cited ? "cited" : r.retrieved ? "retrieved" : "passed over"}
                </span>
                <span style={{ color: T.fgSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  “{r.query}”
                </span>
                <span style={{ color: T.fgMuted, marginLeft: "auto", flexShrink: 0 }}>
                  {r.sim !== null ? `${(r.sim * 100).toFixed(0)}%` : "—"}
                </span>
              </div>
            ))}
          </>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: T.fgMuted }}>{label}</p>
      <p style={{ fontFamily: T.disp, fontWeight: 800, fontSize: 17, color }}>{value}</p>
    </div>
  );
}
