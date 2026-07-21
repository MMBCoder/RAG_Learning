import type { Candidate, Chunk } from "../ragStore";
import { pca3Flat, flatten, toCoords3 } from "./mathCore";

/* ── vector math ──────────────────────────────────────────── */

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/* ── keyword scoring (BM25-lite) ──────────────────────────── */

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "is", "are", "was", "for", "on", "with", "at", "by", "it", "its", "as", "be", "this", "that", "what", "which", "how", "do", "does", "can", "i", "my", "you", "your"]);

function terms(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g)?.filter(t => !STOP.has(t) && t.length > 1) ?? [];
}

export function keywordScores(query: string, chunks: Chunk[]): number[] {
  const qTerms = [...new Set(terms(query))];
  const docs = chunks.map(c => terms(c.text));
  const avgLen = docs.reduce((n, d) => n + d.length, 0) / (docs.length || 1);
  const N = chunks.length;

  // document frequency per query term
  const df = new Map<string, number>();
  for (const t of qTerms) df.set(t, docs.filter(d => d.includes(t)).length);

  const k1 = 1.4, b = 0.75;
  return docs.map(d => {
    let score = 0;
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of qTerms) {
      const f = tf.get(t) ?? 0;
      if (f === 0) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.length / (avgLen || 1))));
    }
    return score;
  });
}

/* ── hybrid scoring ───────────────────────────────────────── */

function normalise(xs: number[]): number[] {
  const max = Math.max(...xs, 1e-9);
  const min = Math.min(...xs, 0);
  return xs.map(x => (x - min) / (max - min || 1));
}

export function scoreCandidates(
  queryVec: number[],
  query: string,
  chunks: Chunk[],
  embeddings: number[][],
  alpha: number,
): Candidate[] {
  const sem = chunks.map((_, i) => cosine(queryVec, embeddings[i]));
  const kw = normalise(keywordScores(query, chunks));
  const semN = normalise(sem);

  const cands: Candidate[] = chunks.map((c, i) => ({
    chunkId: c.id,
    semantic: sem[i],
    keyword: kw[i],
    hybrid: alpha * semN[i] + (1 - alpha) * kw[i],
    rank: 0,
  }));
  cands.sort((a, b) => b.hybrid - a.hybrid);
  cands.forEach((c, i) => { c.rank = i + 1; });
  return cands;
}

/* ── PCA → 3D projection for the embedding space view ─────── */

/** Delegates to the flat-array core (M6) — one implementation shared
    with the analysis worker; the M0 fixtures pin the math. */
export function pca3(vectors: number[][]): [number, number, number][] {
  const n = vectors.length;
  if (n === 0) return [];
  return toCoords3(pca3Flat(flatten(vectors), n, vectors[0].length), n);
}

/** Project a new vector into an existing PCA basis approximated by nearest chunks. */
export function projectQuery(
  queryVec: number[],
  embeddings: number[][],
  coords: [number, number, number][],
): [number, number, number] {
  // weighted average of the 4 nearest chunks' 3D positions
  const sims = embeddings.map(e => cosine(queryVec, e));
  const idx = sims.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 4);
  let wsum = 0;
  const pos: [number, number, number] = [0, 0, 0];
  for (const [s, i] of idx) {
    const w = Math.max(s, 0.01) ** 3;
    wsum += w;
    pos[0] += coords[i][0] * w; pos[1] += coords[i][1] * w; pos[2] += coords[i][2] * w;
  }
  return [pos[0] / wsum, pos[1] / wsum, pos[2] / wsum];
}
