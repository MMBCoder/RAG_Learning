"use client";

import { gsap } from "gsap";
import { useRagStore, type StageId } from "../ragStore";
import { prefersReducedMotion } from "./reducedMotion";

/* ═══════════════════════════════════════════════════════════════════
   THE DIRECTOR (architecture §B2) — attention choreography. A first-
   time learner cannot know where to look among 14 nodes; the Director
   looks FOR them, one concept at a time.

   Strict transform ownership (the GSAP↔Framer truce):
   · GSAP owns ONLY the CameraRig wrapper (flyTo) and chrome opacity.
   · Node opacity (spotlight/recede) goes through the STORE, so Framer
     Motion — which owns node animation — renders it declaratively.
   Reduced motion: cuts, not pans (duration 0).
   ═══════════════════════════════════════════════════════════════════ */

export interface FlyTransform { x: number; y: number; scale: number; }

/** Pure camera math: center the node in the viewport at `scale`. */
export function computeFly(
  viewportW: number, viewportH: number,
  node: { x: number; y: number; w: number; h: number },
  scale: number,
): FlyTransform {
  return {
    x: viewportW / 2 - (node.x + node.w / 2) * scale,
    y: viewportH / 2 - (node.y + node.h / 2) * scale,
    scale,
  };
}

class Director {
  private viewport: HTMLDivElement | null = null;
  private rig: HTMLDivElement | null = null;
  private current: FlyTransform = { x: 0, y: 0, scale: 1 };

  attach(viewport: HTMLDivElement, rig: HTMLDivElement): void {
    this.viewport = viewport;
    this.rig = rig;
  }

  detach(): void {
    this.reset(true);
    this.viewport = null;
    this.rig = null;
  }

  private dur(base: number): number {
    return prefersReducedMotion() ? 0 : base;
  }

  /** Dim every node except one (recede token, rendered by Framer via the store). */
  spotlight(stage: StageId | null): void {
    useRagStore.getState().setSpotlight(stage);
  }

  /** Camera pan/zoom on the rig wrapper — transform-only, 60 fps. */
  flyTo(stage: StageId, scale = 1.22): void {
    if (!this.viewport || !this.rig) return;
    const el = this.viewport.querySelector<HTMLElement>(`[data-stage-id="${stage}"]`);
    if (!el) return;
    const vp = this.viewport.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // remove the current transform to get base coordinates
    const base = {
      x: (r.left - vp.left - this.current.x) / this.current.scale,
      y: (r.top - vp.top - this.current.y) / this.current.scale,
      w: r.width / this.current.scale,
      h: r.height / this.current.scale,
    };
    const t = computeFly(vp.width, vp.height, base, scale);
    this.current = t;
    this.viewport.style.overflow = "hidden";
    gsap.to(this.rig, { x: t.x, y: t.y, scale: t.scale, duration: this.dur(0.85), ease: "power3.inOut" });
  }

  /** Back to the resting frame; releases the viewport clip. */
  reset(instant = false): void {
    this.current = { x: 0, y: 0, scale: 1 };
    if (this.rig) {
      gsap.to(this.rig, {
        x: 0, y: 0, scale: 1, duration: instant ? 0 : this.dur(0.6), ease: "power3.inOut",
        onComplete: () => { if (this.viewport) this.viewport.style.overflow = ""; },
      });
      if (instant && this.viewport) this.viewport.style.overflow = "";
    }
    this.spotlight(null);
  }

  /** Presentation UI fade — everything marked data-rag-chrome recedes. */
  fadeChrome(dim: boolean): void {
    if (typeof document === "undefined") return;
    gsap.to("[data-rag-chrome]", { opacity: dim ? 0.25 : 1, duration: this.dur(0.4) });
  }
}

export const director = new Director();
