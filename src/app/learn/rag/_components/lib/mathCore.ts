/* ═══════════════════════════════════════════════════════════════════
   FLAT-ARRAY MATH CORE (M6) — one implementation, two callers: the
   analysis Web Worker and the synchronous main-thread fallback. The
   PCA mirrors the V1 algorithm operation-for-operation (same seeded
   power iteration, same deflation, same cube normalisation) so the M0
   characterization fixtures hold — off-thread must never mean
   different math.
   ═══════════════════════════════════════════════════════════════════ */

export function flatten(vectors: number[][]): Float64Array {
  const n = vectors.length;
  const d = n ? vectors[0].length : 0;
  const out = new Float64Array(n * d);
  for (let i = 0; i < n; i++) out.set(vectors[i], i * d);
  return out;
}

export function toCoords3(flat: Float64Array, n: number): [number, number, number][] {
  const out: [number, number, number][] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = [flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2]];
  return out;
}

/** Top-3 PCA via seeded power iteration + deflation → n×3, each axis in [-1, 1]. */
export function pca3Flat(data: Float64Array, n: number, d: number): Float64Array {
  const out = new Float64Array(n * 3);
  if (n === 0 || d === 0) return out;

  // mean-centre (division inside the loop matches V1 accumulation order)
  const mean = new Float64Array(d);
  for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) mean[j] += data[i * d + j] / n;
  const X = new Float64Array(n * d);
  for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) X[i * d + j] = data[i * d + j] - mean[j];

  const comps: Float64Array[] = [];
  const work = X.slice();
  for (let c = 0; c < 3; c++) {
    let w = new Float64Array(d);
    for (let j = 0; j < d; j++) w[j] = (Math.sin(j * (c + 1) * 12.9898) * 43758.5453) % 1;
    for (let iter = 0; iter < 24; iter++) {
      const next = new Float64Array(d);
      for (let r = 0; r < n; r++) {
        const off = r * d;
        let dot = 0;
        for (let j = 0; j < d; j++) dot += work[off + j] * w[j];
        for (let j = 0; j < d; j++) next[j] += dot * work[off + j];
      }
      let norm = 0;
      for (let j = 0; j < d; j++) norm += next[j] * next[j];
      norm = Math.sqrt(norm) || 1;
      for (let j = 0; j < d; j++) next[j] /= norm;
      w = next;
    }
    comps.push(w);
    // deflate
    for (let r = 0; r < n; r++) {
      const off = r * d;
      let dot = 0;
      for (let j = 0; j < d; j++) dot += work[off + j] * w[j];
      for (let j = 0; j < d; j++) work[off + j] -= dot * w[j];
    }
  }

  for (let r = 0; r < n; r++) {
    const off = r * d;
    for (let c = 0; c < 3; c++) {
      let dot = 0;
      for (let j = 0; j < d; j++) dot += X[off + j] * comps[c][j];
      out[r * 3 + c] = dot;
    }
  }

  // normalise into a [-1, 1] cube
  for (let c = 0; c < 3; c++) {
    let max = 1e-9;
    for (let r = 0; r < n; r++) max = Math.max(max, Math.abs(out[r * 3 + c]));
    for (let r = 0; r < n; r++) out[r * 3 + c] /= max;
  }
  return out;
}

/** Deterministic k-means on 3D coords (Universe cluster halos, M7).
    Strided seeding — same input, same clusters, every run. */
export function kmeansFlat(
  coords: Float64Array, n: number, k: number, iters = 16,
): { assign: Uint16Array; centroids: Float64Array } {
  const kk = Math.max(1, Math.min(k, n));
  const centroids = new Float64Array(kk * 3);
  for (let c = 0; c < kk; c++) {
    const i = Math.min(n - 1, Math.floor((c + 0.5) * (n / kk)));
    centroids[c * 3] = coords[i * 3];
    centroids[c * 3 + 1] = coords[i * 3 + 1];
    centroids[c * 3 + 2] = coords[i * 3 + 2];
  }
  const assign = new Uint16Array(n);
  const counts = new Uint32Array(kk);
  const sums = new Float64Array(kk * 3);

  for (let iter = 0; iter < iters; iter++) {
    for (let i = 0; i < n; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < kk; c++) {
        const dx = coords[i * 3] - centroids[c * 3];
        const dy = coords[i * 3 + 1] - centroids[c * 3 + 1];
        const dz = coords[i * 3 + 2] - centroids[c * 3 + 2];
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < bestDist) { bestDist = dist; best = c; }
      }
      assign[i] = best;
    }
    counts.fill(0);
    sums.fill(0);
    for (let i = 0; i < n; i++) {
      const c = assign[i];
      counts[c]++;
      sums[c * 3] += coords[i * 3];
      sums[c * 3 + 1] += coords[i * 3 + 1];
      sums[c * 3 + 2] += coords[i * 3 + 2];
    }
    for (let c = 0; c < kk; c++) {
      if (counts[c] === 0) continue;   // empty cluster keeps its centroid
      centroids[c * 3] = sums[c * 3] / counts[c];
      centroids[c * 3 + 1] = sums[c * 3 + 1] / counts[c];
      centroids[c * 3 + 2] = sums[c * 3 + 2] / counts[c];
    }
  }
  return { assign, centroids };
}
