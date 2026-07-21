"use client";

import { useMemo, useState } from "react";
import { useRagStore } from "../ragStore";
import { pageHeat, heatColor, queryRuns } from "../lib/history";
import { ConceptTrigger } from "../education/ConceptCard";
import { T, eyebrow } from "../theme";

/* Retrieval Heat Map (F7): which parts of the document your questions
   actually used. The legend IS the lesson — this is not "importance",
   it's a mirror of what YOU asked. Ask different questions and the map
   changes. */

export default function PageHeat() {
  const events = useRagStore(s => s.events);
  const openProfile = useRagStore(s => s.openChunkProfile);
  const [zoomPage, setZoomPage] = useState<number | null>(null);

  const cells = useMemo(() => pageHeat(events), [events]);
  const runs = useMemo(() => queryRuns(events).length, [events]);
  if (cells.length === 0 || runs === 0) return null;

  const max = Math.max(...cells.map(c => c.count), 1);
  const zoomed = zoomPage !== null ? cells.find(c => c.page === zoomPage) : null;

  return (
    <div>
      <p style={{ ...eyebrow, marginBottom: 10 }}>
        <ConceptTrigger id="top-k">retrieval heat map</ConceptTrigger> — where your {runs} question{runs === 1 ? "" : "s"} landed
      </p>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {cells.map(c => (
          <button
            key={c.page}
            data-heat-page={c.page}
            data-heat-count={c.count}
            onClick={() => setZoomPage(zoomPage === c.page ? null : c.page)}
            title={`page ${c.page} · ${c.count} retrieval${c.count === 1 ? "" : "s"}`}
            aria-label={`Page ${c.page}: ${c.count} retrievals`}
            style={{
              width: 40, height: 48, borderRadius: 7, cursor: "pointer",
              background: heatColor(c.count, max),
              border: `1.5px solid ${zoomPage === c.page ? T.violet : T.border}`,
              fontFamily: T.mono, fontSize: 10.5, color: T.fg, fontWeight: 600,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            }}
          >
            <span>p.{c.page}</span>
            <span style={{ fontSize: 9.5, color: T.fgSec }}>{c.count || "·"}</span>
          </button>
        ))}
      </div>

      {zoomed && (
        <div style={{ padding: "10px 12px", borderRadius: 10, background: T.inset, border: `1px solid ${T.border}`, marginBottom: 8 }}>
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgSec, marginBottom: 6 }}>
            page {zoomed.page} — per-chunk retrievals (click for a life story)
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {zoomed.chunks.length === 0 && (
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted }}>nothing retrieved from this page yet</span>
            )}
            {zoomed.chunks.map(cc => (
              <button
                key={cc.id}
                onClick={() => openProfile(cc.id)}
                style={{
                  padding: "5px 11px", borderRadius: 8, cursor: "pointer",
                  background: heatColor(cc.count, max), border: `1px solid ${T.borderStrong}`,
                  fontFamily: T.mono, fontSize: 11, color: T.fg, fontWeight: 600,
                }}
              >
                [{cc.id}] ×{cc.count}
              </button>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, lineHeight: 1.6 }}>
        hot = frequently retrieved <em>for your questions</em> — not “important”. ask different questions and the map redraws.
      </p>
    </div>
  );
}
