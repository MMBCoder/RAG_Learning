"use client";

import { pca3Flat, kmeansFlat, flatten, toCoords3 } from "../mathCore";
import type { AnalysisRequest, AnalysisResponse } from "./analysis.worker";

/* Promise API over the analysis worker with a synchronous fallback:
   SSR, jsdom, and Worker-less browsers run the identical mathCore on
   the main thread — same functions, same fixtures, same results. */

let worker: Worker | null | undefined;   // undefined = not tried yet
let seq = 0;
const pending = new Map<number, { resolve: (r: AnalysisResponse) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    worker = null;
    return null;
  }
  try {
    worker = new Worker(new URL("./analysis.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<AnalysisResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data);
      else p.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      pending.forEach(p => p.reject(new Error("analysis worker crashed")));
      pending.clear();
      worker?.terminate();
      worker = null;   // subsequent calls fall back to main thread
    };
  } catch {
    worker = null;
  }
  return worker;
}

function call(w: Worker, req: Omit<AnalysisRequest, "id">, transfer: ArrayBufferLike[]): Promise<AnalysisResponse> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...req, id }, transfer as Transferable[]);
  });
}

/** PCA off the main thread; identical math on the main thread if no worker. */
export async function pca3Async(vectors: number[][]): Promise<[number, number, number][]> {
  const n = vectors.length;
  if (n === 0) return [];
  const d = vectors[0].length;
  const w = getWorker();
  if (!w) return toCoords3(pca3Flat(flatten(vectors), n, d), n);
  try {
    const flat = flatten(vectors);
    const res = await call(w, { op: "pca3", buffer: flat.buffer, n, d }, [flat.buffer]);
    if (res.ok && res.op === "pca3") return toCoords3(new Float64Array(res.buffer), n);
    throw new Error("unexpected worker response");
  } catch {
    // buffer was transferred — re-flatten for the fallback
    return toCoords3(pca3Flat(flatten(vectors), n, d), n);
  }
}

/** Deterministic k-means over 3D coords (Universe halos, M7). */
export async function kmeansAsync(
  coords: [number, number, number][], k: number,
): Promise<{ assign: number[]; centroids: [number, number, number][] }> {
  const n = coords.length;
  const pack = () => {
    const flat = new Float64Array(n * 3);
    coords.forEach((c, i) => { flat[i * 3] = c[0]; flat[i * 3 + 1] = c[1]; flat[i * 3 + 2] = c[2]; });
    return flat;
  };
  const unpack = (assign: Uint16Array, centroids: Float64Array, kk: number) => ({
    assign: Array.from(assign),
    centroids: toCoords3(centroids, kk),
  });
  if (n === 0) return { assign: [], centroids: [] };
  const w = getWorker();
  if (!w) {
    const r = kmeansFlat(pack(), n, k);
    return unpack(r.assign, r.centroids, Math.max(1, Math.min(k, n)));
  }
  try {
    const flat = pack();
    const res = await call(w, { op: "kmeans", buffer: flat.buffer, n, d: 3, k }, [flat.buffer]);
    if (res.ok && res.op === "kmeans") {
      return unpack(new Uint16Array(res.assign), new Float64Array(res.centroids), Math.max(1, Math.min(k, n)));
    }
    throw new Error("unexpected worker response");
  } catch {
    const r = kmeansFlat(pack(), n, k);
    return unpack(r.assign, r.centroids, Math.max(1, Math.min(k, n)));
  }
}
