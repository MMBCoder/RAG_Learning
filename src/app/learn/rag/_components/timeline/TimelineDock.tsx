"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Radio, StepBack, StepForward } from "lucide-react";
import { useRagStore, STAGE_IDS, type StageId } from "../ragStore";
import { INGESTION_STAGES, STAGE_BY_ID } from "../stages";
import { ConceptTrigger } from "../education/ConceptCard";
import { T, eyebrow } from "../theme";

/* F2: the run as a scrubbable film strip. One block per stage, width =
   MEASURED duration (the latency lesson: network stages dwarf local
   math). Scrubbing projects history; the live store is never touched.
   The time scale is plain linear math — same result as a d3 scale
   without shipping d3 for one axis. */

const INGESTION_IDS = new Set<StageId>(INGESTION_STAGES.map(s => s.id));

export default function TimelineDock() {
  const events = useRagStore(s => s.events);
  const scrubSeq = useRagStore(s => s.scrubSeq);
  const stages = useRagStore(s => s.stages);

  // scrubbing also seeks the Director: the scrubbed stage gets the spotlight
  const setScrub = (seq: number | null) => {
    const s = useRagStore.getState();
    s.setScrub(seq);
    if (seq === null) { s.setSpotlight(null); return; }
    const ev = [...s.events].reverse().find(e => e.seq <= seq);
    s.setSpotlight(ev?.stage ?? null);
  };

  // the latest run's events — the strip always shows the most recent film
  const run = useMemo(() => {
    if (events.length === 0) return null;
    const lastRunId = events[events.length - 1].runId;
    const evs = events.filter(e => e.runId === lastRunId);
    if (evs.length < 2) return null;   // nothing to scrub until a stage lands
    const t0 = evs[0].t;
    const t1 = evs[evs.length - 1].t;
    return { evs, t0, span: Math.max(1, t1 - t0) };
  }, [events]);

  if (!run) return null;

  const { evs, t0, span } = run;
  const firstSeq = evs[0].seq;
  const lastSeq = evs[evs.length - 1].seq;
  const pos = scrubSeq ?? lastSeq;
  const current = evs.reduce((best, e) => (e.seq <= pos ? e : best), evs[0]);
  const anyRunning = STAGE_IDS.some(id => stages[id].status === "running");
  const scrubbing = scrubSeq !== null;

  const fmtT = (t: number) => `${((t - t0) / 1000).toFixed(1)}s`;

  return (
    <div data-testid="timeline-dock" style={{ marginTop: 22, paddingTop: 16, borderTop: `1px dashed ${T.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <p style={{ ...eyebrow, display: "flex", alignItems: "center", gap: 7 }}>
          <History size={13} />
          replay timeline · <ConceptTrigger id="latency">where the time went</ConceptTrigger>
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setScrub(Math.max(firstSeq, pos - 1))}
            aria-label="Step back one event" disabled={pos <= firstSeq}
            style={transportBtn}
          >
            <StepBack size={13} />
          </button>
          <button
            onClick={() => { const n = pos + 1; if (n >= lastSeq) setScrub(null); else setScrub(n); }}
            aria-label="Step forward one event" disabled={!scrubbing}
            style={transportBtn}
          >
            <StepForward size={13} />
          </button>
          <AnimatePresence>
            {scrubbing && (
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                onClick={() => setScrub(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 13px",
                  borderRadius: 9, cursor: "pointer",
                  background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.45)",
                  fontFamily: T.mono, fontSize: 11.5, fontWeight: 600, color: T.red,
                }}
              >
                <Radio size={12} /> return to live
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {scrubbing && anyRunning && (
        <p role="status" style={{
          marginBottom: 10, padding: "7px 12px", borderRadius: 9,
          background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.4)",
          fontFamily: T.mono, fontSize: 11.5, color: T.amber, fontWeight: 600,
        }}>
          viewing history — the pipeline is still running live
        </p>
      )}

      {/* duration blocks: real measured widths — the latency lesson */}
      <div style={{ position: "relative", height: 34, borderRadius: 8, background: T.inset, border: `1px solid ${T.border}`, overflow: "hidden", marginBottom: 8 }}>
        {evs.filter(e => e.kind === "stage-done" && e.stage).map(e => {
          const ms = e.ms ?? 0;
          const left = ((e.t - t0 - ms) / span) * 100;
          const width = (ms / span) * 100;
          const ingestion = INGESTION_IDS.has(e.stage!);
          const past = e.seq <= pos;
          return (
            <button
              key={e.seq}
              onClick={() => setScrub(e.seq === lastSeq ? null : e.seq)}
              title={`${STAGE_BY_ID[e.stage!].title} · ${ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`}`}
              aria-label={`Scrub to ${STAGE_BY_ID[e.stage!].title} (${fmtT(e.t)})`}
              style={{
                position: "absolute", top: 4, bottom: 4,
                left: `${Math.max(0, left)}%`, width: `${Math.max(0.8, width)}%`,
                borderRadius: 5, cursor: "pointer", border: "none", padding: 0,
                background: ingestion ? "rgba(37,99,235,0.65)" : "rgba(124,58,237,0.65)",
                opacity: past ? 1 : 0.3,
                transition: "opacity 0.2s",
              }}
            />
          );
        })}
        {/* scrub head */}
        <div aria-hidden style={{
          position: "absolute", top: 0, bottom: 0, width: 2,
          left: `${((current.t - t0) / span) * 100}%`,
          background: T.fg, opacity: scrubbing ? 0.8 : 0.25,
          transition: "left 0.15s",
        }} />
      </div>

      <input
        type="range"
        aria-label="Scrub pipeline history"
        min={firstSeq} max={lastSeq} step={1} value={pos}
        onChange={e => {
          const v = Number(e.target.value);
          setScrub(v >= lastSeq ? null : v);
        }}
        style={{ width: "100%", accentColor: T.violet, cursor: "pointer" }}
      />

      <p style={{ fontFamily: T.mono, fontSize: 11.5, color: scrubbing ? T.violet : T.fgMuted, marginTop: 4 }}>
        {current.kind === "run-start"
          ? `t+0.0s · before the ${current.runKind} run started`
          : `t+${fmtT(current.t)} · ${STAGE_BY_ID[current.stage!].title} done${current.note ? ` — ${current.note}` : ""}`}
        {!scrubbing && " · live"}
      </p>
    </div>
  );
}

const transportBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 8, cursor: "pointer",
  background: T.panel, border: `1px solid ${T.borderStrong}`, color: T.fgSec,
};
