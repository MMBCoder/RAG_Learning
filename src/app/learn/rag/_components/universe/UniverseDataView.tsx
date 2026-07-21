"use client";

import { useRagStore } from "../ragStore";
import { useWindowed } from "../lib/useWindowed";
import { T } from "../theme";
import type { UniverseData } from "./useUniverseData";

/* The universe as a table — identical information to the 3D scene
   (a11y / no-WebGL / low-end fallback, and honest verification: the
   glowing dots and these rows come from the same derivation). */

export default function UniverseDataView({ data, height }: { data: UniverseData; height: number }) {
  const setHoverChunk = useRagStore(s => s.setHoverChunk);
  const win = useWindowed(data.chunks, 30, height - 40);

  if (data.chunks.length === 0) {
    return (
      <p style={{ fontFamily: T.mono, fontSize: 12.5, color: T.fgMuted, padding: 12 }}>
        run the pipeline to populate the semantic space
      </p>
    );
  }

  const th: React.CSSProperties = {
    position: "sticky", top: 0, background: T.panel, textAlign: "left",
    fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase",
    color: T.fgMuted, padding: "6px 8px", borderBottom: `1px solid ${T.borderStrong}`,
  };
  const td: React.CSSProperties = {
    fontFamily: T.mono, fontSize: 11.5, color: T.fgSec, padding: "5px 8px",
    borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap",
  };

  return (
    <div
      onScroll={win.onScroll}
      style={{ height, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 12 }}
    >
      <table aria-label="Embedding universe data" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>chunk</th><th style={th}>page</th><th style={th}>tokens</th>
            <th style={th}>similarity</th><th style={th}>status</th><th style={th}>cluster</th>
          </tr>
        </thead>
        <tbody>
          {win.padTop > 0 && <tr aria-hidden style={{ height: win.padTop }} />}
          {win.slice.map(d => (
            <tr
              key={d.id}
              data-universe-row={d.id}
              data-retrieved={d.retrieved || undefined}
              onMouseEnter={() => setHoverChunk(d.id)}
              onMouseLeave={() => setHoverChunk(null)}
              style={{ background: d.retrieved ? "rgba(52,211,153,0.08)" : d.cited ? "rgba(251,191,36,0.07)" : "transparent" }}
            >
              <td style={{ ...td, color: T.blue, fontWeight: 600 }}>#{d.id}</td>
              <td style={td}>{d.page}</td>
              <td style={td}>{d.tokens}</td>
              <td style={td}>{d.sim !== null ? `${(d.sim * 100).toFixed(0)}%` : "—"}</td>
              <td style={{ ...td, color: d.retrieved ? T.green : d.cited ? T.amber : T.fgMuted }}>
                {d.retrieved ? "retrieved ✓" : d.cited ? "cited" : "·"}
              </td>
              <td style={td}>{data.clusters[d.cluster]?.label ?? "—"}</td>
            </tr>
          ))}
          {win.padBottom > 0 && <tr aria-hidden style={{ height: win.padBottom }} />}
        </tbody>
      </table>
    </div>
  );
}
