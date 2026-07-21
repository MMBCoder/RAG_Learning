/* Per-sentence verdict parsing (M9) — malformed-safe by contract: any
   deviation from the schema degrades to doc-level scores only (V1
   behaviour), never to a wrong per-sentence claim. */

export type SupportLevel = "supported" | "partial" | "unsupported";

export interface SentenceVerdict {
  support: SupportLevel;
  evidence: number[];   // chunk ids the judge points at
}

const LEVELS = new Set<string>(["supported", "partial", "unsupported"]);

export function parseSentenceVerdicts(raw: unknown, count: number): SentenceVerdict[] | null {
  if (!Array.isArray(raw) || count <= 0) return null;
  const out: SentenceVerdict[] = [];
  for (let i = 0; i < count; i++) {
    const v = raw[i] as { support?: unknown; evidence?: unknown } | undefined;
    if (!v || typeof v !== "object") return null;
    if (typeof v.support !== "string" || !LEVELS.has(v.support)) return null;
    const evidence = Array.isArray(v.evidence)
      ? v.evidence.filter((x): x is number => Number.isInteger(x) && (x as number) >= 0)
      : [];
    out.push({ support: v.support as SupportLevel, evidence });
  }
  return out;
}

/** Latency cap: the judge reads at most this many sentences per call. */
export const MAX_VERDICT_SENTENCES = 25;
