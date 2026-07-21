"use client";

import { useMemo } from "react";
import { useRagStore, STAGE_IDS } from "../ragStore";
import { STAGE_BY_ID } from "../stages";
import { latencySamples } from "../lib/history";
import { ConceptTrigger } from "../education/ConceptCard";
import { usePersona } from "../education/usePersona";
import { T, eyebrow } from "../theme";

/* Researcher lens (M11): per-stage latency DISTRIBUTIONS from real
   samples across runs — a strip plot with the median marked. Appears
   once ≥3 samples exist for some stage; single runs stay on the plain
   latency bars. */

export default function LatencyDistribution() {
  const events = useRagStore(s => s.events);
  const { lens } = usePersona();
  const samples = useMemo(() => latencySamples(events), [events]);

  if (lens !== "evaluation") return null;
  const stages = STAGE_IDS.filter(id => (samples[id]?.length ?? 0) >= 3);
  if (stages.length === 0) return null;

  const globalMax = Math.max(...stages.flatMap(id => samples[id]!), 1);

  return (
    <div data-latency-distribution>
      <p style={{ ...eyebrow, marginBottom: 10 }}>
        <ConceptTrigger id="latency">latency distributions</ConceptTrigger> — real samples across runs
      </p>
      {stages.map(id => {
        const xs = [...samples[id]!].sort((a, b) => a - b);
        const median = xs[Math.floor(xs.length / 2)];
        return (
          <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.fgSec, width: 118, flexShrink: 0 }}>
              {STAGE_BY_ID[id].title.toLowerCase()} <span style={{ color: T.fgMuted }}>n={xs.length}</span>
            </span>
            <div style={{ position: "relative", flex: 1, height: 16 }}>
              <div style={{ position: "absolute", inset: "7px 0", background: "rgba(15,23,42,0.06)", borderRadius: 2 }} />
              {xs.map((v, i) => (
                <span key={i} style={{
                  position: "absolute", top: 3, width: 6, height: 10, borderRadius: 2,
                  left: `${(v / globalMax) * 97}%`,
                  background: "rgba(124,58,237,0.4)",
                }} />
              ))}
              <span title={`median ${median}ms`} style={{
                position: "absolute", top: 0, width: 2.5, height: 16,
                left: `${(median / globalMax) * 97}%`, background: T.violet,
              }} />
            </div>
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, width: 62, textAlign: "right" }}>
              med {median >= 1000 ? `${(median / 1000).toFixed(1)}s` : `${median}ms`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
