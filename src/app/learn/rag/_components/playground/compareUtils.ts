import type { RagParams, Chunk, EvalScores } from "../ragStore";
import type { RunPin } from "../store/compareSlice";
import { PRICING } from "../ragStore";

/* Pure A/B mechanics (M12) — embed-reuse detection and the diff facts
   the explanation engine consumes. Every number here is measured. */

/** Params whose change invalidates embeddings (everything else re-uses them). */
const CHUNKING_KEYS: (keyof RagParams)[] = ["chunkSize", "chunkOverlap"];

export function changedParams(a: RagParams, b: RagParams): (keyof RagParams)[] {
  return (Object.keys(a) as (keyof RagParams)[]).filter(k => a[k] !== b[k]);
}

export interface EmbedReuse {
  reuse: boolean;
  /** honest preview of the EXTRA embedding cost B will incur */
  estCostUSD: number;
  estTokens: number;
}

export function embedReuse(a: RagParams, b: RagParams, chunks: Chunk[]): EmbedReuse {
  const rechunk = CHUNKING_KEYS.some(k => a[k] !== b[k]);
  if (!rechunk) return { reuse: true, estCostUSD: 0, estTokens: 0 };
  const estTokens = chunks.reduce((n, c) => n + c.tokens, 0);
  return { reuse: false, estTokens, estCostUSD: (estTokens * PRICING.embedInput) / 1e6 };
}

export interface DiffFacts {
  paramsChanged: (keyof RagParams)[];
  scoresA: EvalScores | null;
  scoresB: EvalScores | null;
  retrievedA: number[];
  retrievedB: number[];
  shared: number[];
  onlyA: number[];
  onlyB: number[];
  latencyAMs: number;
  latencyBMs: number;
  costDeltaUSD: number;   // real usage delta between pin and now
}

export function buildDiffFacts(
  pin: RunPin,
  live: {
    params: RagParams; results: number[]; evalScores: EvalScores | null;
    queryMs: number; costUSD: number;
  },
): DiffFacts {
  const a = new Set(pin.results);
  const b = new Set(live.results);
  return {
    paramsChanged: changedParams(pin.params, live.params),
    scoresA: pin.evalScores,
    scoresB: live.evalScores,
    retrievedA: pin.results,
    retrievedB: live.results,
    shared: pin.results.filter(id => b.has(id)),
    onlyA: pin.results.filter(id => !b.has(id)),
    onlyB: live.results.filter(id => !a.has(id)),
    latencyAMs: pin.queryMs,
    latencyBMs: live.queryMs,
    costDeltaUSD: Math.max(0, live.costUSD - pin.usageAt.costUSD),
  };
}
