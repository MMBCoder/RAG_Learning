"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Boxes, Table2, Maximize2, X } from "lucide-react";
import { useUniverseData } from "./useUniverseData";
import UniverseDataView from "./UniverseDataView";
import { usePersona } from "../education/usePersona";
import { useIsMobile } from "../../../_components/shared/useIsMobile";
import { T, DEPTH } from "../theme";

/* The Embedding Universe shell (F4): 3D scene + data view over ONE
   derivation, with the degradation ladder — WebGL missing → data view;
   mobile → data-view-first with capped instances behind a tap. */

const Universe3D = dynamic(() => import("./Universe3D"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: 260, display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 12, border: `1.5px dashed ${T.borderStrong}`, background: T.inset,
      fontFamily: T.mono, fontSize: 12.5, color: T.fgMuted,
    }}>
      loading the universe…
    </div>
  ),
});

const MOBILE_INSTANCE_CAP = 400;

function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Universe({ height = 260 }: { height?: number }) {
  const data = useUniverseData();
  const persona = usePersona();
  const isMobile = useIsMobile(700);
  const [webgl] = useState(webglAvailable);
  const [view, setView] = useState<"3d" | "data" | null>(null);   // null → heuristic default
  const [expanded, setExpanded] = useState(false);

  const effectiveView = view ?? (!webgl ? "data" : isMobile ? "data" : "3d");
  const capped = isMobile && data.chunks.length > MOBILE_INSTANCE_CAP;
  const sceneData = capped ? { ...data, chunks: data.chunks.slice(0, MOBILE_INSTANCE_CAP) } : data;

  if (data.chunks.length === 0) {
    return (
      <div style={{
        height, display: "flex", alignItems: "center", justifyContent: "center",
        border: `1.5px dashed ${T.borderStrong}`, borderRadius: 12, background: T.inset,
        fontFamily: T.mono, fontSize: 12.5, color: T.fgMuted,
      }}>
        run the pipeline to populate the semantic space
      </div>
    );
  }

  const body = (h: number) => effectiveView === "3d" && webgl
    ? <Universe3D data={sceneData} height={h} halos={!isMobile} />
    : <UniverseDataView data={data} height={h} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setView("3d")}
          disabled={!webgl}
          aria-pressed={effectiveView === "3d"}
          style={viewBtn(effectiveView === "3d")}
          title={webgl ? undefined : "WebGL unavailable — data view carries the same information"}
        >
          <Boxes size={12} /> 3d
        </button>
        <button onClick={() => setView("data")} aria-pressed={effectiveView === "data"} style={viewBtn(effectiveView === "data")}>
          <Table2 size={12} /> data view
        </button>
        <div style={{ flex: 1 }} />
        {capped && effectiveView === "3d" && (
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted }}>
            showing {MOBILE_INSTANCE_CAP} of {data.chunks.length} — data view lists all
          </span>
        )}
        <button onClick={() => setExpanded(true)} aria-label="Expand universe" style={viewBtn(false)}>
          <Maximize2 size={12} />
        </button>
      </div>

      {body(height)}

      <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted, marginTop: 8, lineHeight: 1.6 }}>
        {persona.voice === "analogy"
          ? "every chunk has coordinates on a map of meaning — passages about the same thing are neighbours, and your question lands among its answers"
          : persona.voice === "statistical"
            ? `${data.chunks.length} points · PCA of 768-D → 3-D (neighbourhoods preserved, distances approximate) · ${data.clusters.length} k-means clusters, TF-labelled`
            : "PCA projection of the real embedding vectors — clusters are k-means over the projected space, labelled by their most characteristic terms"}
      </p>

      {expanded && typeof document !== "undefined" && createPortal(
        // portaled to <body>: the Inspector's transform would otherwise trap
        // this fixed overlay in a stacking context below the site nav
        <div style={{
          position: "fixed", inset: 0, zIndex: 110, display: "flex", flexDirection: "column",
          padding: 18, background: "rgba(10,12,16,0.92)", backdropFilter: "blur(6px)",
        }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button
              onClick={() => setExpanded(false)}
              aria-label="Close universe"
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
                borderRadius: 10, cursor: "pointer", background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.25)", color: "#fff",
                fontFamily: T.mono, fontSize: 12.5, boxShadow: DEPTH.floating,
              }}
            >
              <X size={14} /> close
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {body(typeof window !== "undefined" ? window.innerHeight - 110 : 600)}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const viewBtn = (active: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
  borderRadius: 8, cursor: "pointer",
  background: active ? "rgba(124,58,237,0.08)" : "transparent",
  border: `1px solid ${active ? "rgba(124,58,237,0.5)" : T.border}`,
  fontFamily: T.mono, fontSize: 11, fontWeight: 600,
  color: active ? T.violet : T.fgSec,
});
