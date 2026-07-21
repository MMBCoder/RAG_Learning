"use client";

import { useEffect, useRef, type RefObject } from "react";
import { usePipelineView } from "../timeline/usePipelineView";
import { useNodeRects, type RectMap } from "./useNodeRects";
import { PIPELINE_EDGES, PacketSystem, type EdgeDef } from "./PacketSystem";

/* F1: one absolutely-positioned SVG spanning the canvas. Edges are
   measured paths between real node rects; the active edge highlights
   while its target stage runs (this static highlight is ALSO the
   reduced-motion variant of `packet-flow`). PacketSystem appends its
   moving glyphs into this same SVG imperatively. */

function edgePath(rects: RectMap, e: EdgeDef): string | null {
  const a = rects[e.from];
  const b = rects[e.to];
  if (!a || !b) return null;

  // same visual row → horizontal edge out of the right face
  if (b.x >= a.x + a.w - 4 && Math.abs(b.y - a.y) < a.h) {
    const x1 = a.x + a.w, y1 = a.y + a.h / 2;
    const x2 = b.x, y2 = b.y + b.h / 2;
    const dx = Math.max(8, (x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }
  // otherwise → vertical/diagonal sweep from bottom face to top face
  const x1 = a.x + a.w / 2, y1 = a.y + a.h;
  const x2 = b.x + b.w / 2, y2 = b.y;
  const dy = Math.max(10, (y2 - y1) / 2);
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
}

export default function EdgeLayer({
  containerRef, isMobile,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  isMobile: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const stages = usePipelineView(s => s.stages);
  const rects = useNodeRects(containerRef, isMobile);

  useEffect(() => {
    if (!svgRef.current) return;
    const system = new PacketSystem(svgRef.current);
    return () => system.destroy();
  }, []);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", overflow: "visible",
      }}
    >
      {PIPELINE_EDGES.map(e => {
        const d = edgePath(rects, e);
        if (!d) return null;
        const active = stages[e.to].status === "running" && stages[e.from].status === "done";
        return (
          <path
            key={e.id}
            id={`rag-edge-${e.id}`}
            data-edge={e.id}
            data-edge-active={active || undefined}
            d={d}
            fill="none"
            stroke={active ? "rgba(37,99,235,0.6)" : "rgba(203,213,225,0.9)"}
            strokeWidth={active ? 2.5 : 1.75}
            strokeLinecap="round"
            style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
          />
        );
      })}
    </svg>
  );
}
