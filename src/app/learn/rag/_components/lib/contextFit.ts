import type { Chunk } from "../ragStore";

/* THE context-packing truth (M8). The prompt stage and the Context
   Container vessel both call this one function, so what the vessel
   shows is — by construction — exactly what the next prompt contains.
   (Extracted verbatim from the V1 prompt stage.) */

export interface ContextFit {
  kept: number[];      // chunk ids that fit, in rank order
  dropped: number[];   // retrieved but evicted by the budget
  ctxTokens: number;   // tokens consumed by the kept chunks
}

export function fitContext(resultIds: number[], chunks: Chunk[], budget: number): ContextFit {
  const byId = new Map(chunks.map(c => [c.id, c]));
  const kept: number[] = [];
  let ctxTokens = 0;
  let i = 0;
  for (; i < resultIds.length; i++) {
    const ch = byId.get(resultIds[i]);
    if (!ch) continue;
    // V1 semantics: rank order is sacred — the first chunk that doesn't
    // fit ends the packing (no cherry-picking smaller, lower-ranked ones)
    if (ctxTokens + ch.tokens > budget && kept.length > 0) break;
    kept.push(resultIds[i]);
    ctxTokens += ch.tokens;
  }
  return { kept, dropped: resultIds.slice(i), ctxTokens };
}
