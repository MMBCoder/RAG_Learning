import type { DiffFacts } from "../playground/compareUtils";

/* The Explanation Engine (M12): deterministic sentences built ONLY from
   measured diffs. The honesty contract, enforced by unit test: every
   number a sentence quotes exists in the DiffFacts it was built from —
   no unbound claims, no LLM prose pretending to be measurement. */

export function explainDiff(f: DiffFacts): string[] {
  const out: string[] = [];

  if (f.paramsChanged.length > 0) {
    out.push(`Changed between A and B: ${f.paramsChanged.join(", ")}.`);
  }

  if (f.scoresA && f.scoresB) {
    const dRisk = f.scoresB.hallucinationRisk - f.scoresA.hallucinationRisk;
    const dFaith = f.scoresB.faithfulness - f.scoresA.faithfulness;
    if (Math.abs(dRisk) >= 5) {
      out.push(`Hallucination risk moved from ${f.scoresA.hallucinationRisk} to ${f.scoresB.hallucinationRisk} (${dRisk > 0 ? "+" : ""}${dRisk}).`);
    }
    if (Math.abs(dFaith) >= 5) {
      out.push(`Faithfulness moved from ${f.scoresA.faithfulness} to ${f.scoresB.faithfulness} (${dFaith > 0 ? "+" : ""}${dFaith}).`);
    }
    const dPrec = f.scoresB.contextPrecision - f.scoresA.contextPrecision;
    if (Math.abs(dPrec) >= 10) {
      out.push(`Context precision went ${dPrec > 0 ? "up" : "down"}: ${f.scoresA.contextPrecision} → ${f.scoresB.contextPrecision}.`);
    }
  }

  const total = new Set([...f.retrievedA, ...f.retrievedB]).size;
  if (total > 0 && (f.onlyA.length > 0 || f.onlyB.length > 0)) {
    const parts = [`A and B share ${f.shared.length} of ${total} retrieved chunks`];
    if (f.onlyB.length) parts.push(`B added [${f.onlyB.join(", ")}]`);
    if (f.onlyA.length) parts.push(`B lost [${f.onlyA.join(", ")}]`);
    out.push(parts.join("; ") + ".");
  }

  const dLat = f.latencyBMs - f.latencyAMs;
  if (Math.abs(dLat) >= 500) {
    out.push(`B answered in ${(f.latencyBMs / 1000).toFixed(1)}s vs A's ${(f.latencyAMs / 1000).toFixed(1)}s (${dLat > 0 ? "+" : ""}${(dLat / 1000).toFixed(1)}s).`);
  }

  if (f.costDeltaUSD > 0) {
    out.push(`Running B cost $${f.costDeltaUSD.toFixed(4)} on top of A — measured from real usage, not estimated.`);
  }

  if (out.length <= 1) {
    out.push("No significant measured difference — for this document and question, that dial barely matters. Also a finding.");
  }

  return out;
}
