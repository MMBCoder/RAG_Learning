"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import type { StageId } from "../store/types";

/* F1: measured node geometry. Stage cards mark themselves with
   [data-stage-id]; this hook returns their rects relative to the canvas
   container, re-measured on any resize. EdgeLayer draws real paths from
   these — no hand-tuned coordinates that drift when layout changes. */

export interface NodeRect { x: number; y: number; w: number; h: number; }
export type RectMap = Partial<Record<StageId, NodeRect>>;

function rectsEqual(a: RectMap, b: RectMap): boolean {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => {
    const ra = a[k as StageId], rb = b[k as StageId];
    return !!ra && !!rb && ra.x === rb.x && ra.y === rb.y && ra.w === rb.w && ra.h === rb.h;
  });
}

export function useNodeRects(
  containerRef: RefObject<HTMLDivElement | null>,
  layoutKey: unknown,   // anything that changes node arrangement (e.g. isMobile)
): RectMap {
  const [rects, setRects] = useState<RectMap>({});

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const next: RectMap = {};
    root.querySelectorAll<HTMLElement>("[data-stage-id]").forEach(el => {
      const r = el.getBoundingClientRect();
      next[el.dataset.stageId as StageId] = {
        x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height,
      };
    });
    setRects(prev => (rectsEqual(prev, next) ? prev : next));
  }, [containerRef]);

  useEffect(() => {
    measure();
    const root = containerRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll<HTMLElement>("[data-stage-id]").forEach(el => ro.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, containerRef, layoutKey]);

  return rects;
}
