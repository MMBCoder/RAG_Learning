"use client";

import { useState, type UIEvent } from "react";

/* Minimal list windowing (M6): render only the visible rows plus a
   buffer. Kicks in above `threshold` so short lists keep their entrance
   animations and long lists (1,000 chunks) stay scroll-smooth. */

export interface Windowed<T> {
  slice: T[];
  start: number;
  padTop: number;
  padBottom: number;
  windowed: boolean;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
}

export function useWindowed<T>(
  items: T[], rowH: number, viewportH: number, threshold = 60,
): Windowed<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const windowed = items.length > threshold;
  if (!windowed) {
    return { slice: items, start: 0, padTop: 0, padBottom: 0, windowed, onScroll: () => {} };
  }
  const buffer = 6;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
  const count = Math.ceil(viewportH / rowH) + buffer * 2;
  const end = Math.min(items.length, start + count);
  return {
    slice: items.slice(start, end),
    start,
    padTop: start * rowH,
    padBottom: (items.length - end) * rowH,
    windowed,
    onScroll: e => setScrollTop(e.currentTarget.scrollTop),
  };
}
