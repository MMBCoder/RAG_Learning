import { pca3Flat, kmeansFlat } from "../mathCore";

/* The analysis worker (M6): PCA and k-means run off the main thread so
   a 1,000-chunk ingest never blocks the UI. Buffers travel as
   transferables — zero-copy in both directions. */

export interface AnalysisRequest {
  id: number;
  op: "pca3" | "kmeans";
  buffer: ArrayBufferLike;
  n: number;
  d: number;        // dims for pca3; ignored for kmeans (always 3)
  k?: number;       // kmeans cluster count
}

export type AnalysisResponse =
  | { id: number; ok: true; op: "pca3"; buffer: ArrayBufferLike; n: number }
  | { id: number; ok: true; op: "kmeans"; assign: ArrayBufferLike; centroids: ArrayBufferLike; n: number; k: number }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  const { id, op, buffer, n, d, k } = e.data;
  try {
    if (op === "pca3") {
      const out = pca3Flat(new Float64Array(buffer), n, d);
      ctx.postMessage({ id, ok: true, op, buffer: out.buffer, n } satisfies AnalysisResponse, [out.buffer as ArrayBuffer]);
    } else {
      const res = kmeansFlat(new Float64Array(buffer), n, k ?? 6);
      ctx.postMessage(
        { id, ok: true, op, assign: res.assign.buffer, centroids: res.centroids.buffer, n, k: k ?? 6 } satisfies AnalysisResponse,
        [res.assign.buffer as ArrayBuffer, res.centroids.buffer as ArrayBuffer],
      );
    }
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies AnalysisResponse);
  }
};
