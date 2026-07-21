"use client";

import { useEffect, useRef, useState } from "react";
import { usePipelineView } from "../timeline/usePipelineView";
import { useRagStore, PRICING } from "../ragStore";
import { dayKey } from "../store/historySlice";
import { ConceptTrigger } from "../education/ConceptCard";
import { useReducedMotion } from "../motion/reducedMotion";
import { T, eyebrow } from "../theme";

/* Cost Meter (F10): the money made tangible. Session cost counts up as
   real API responses land; the embed/generate split shows WHERE money
   goes (output tokens ≈ 80× embedding tokens); "today" persists across
   sessions via the real day ledger. Estimates say so. */

function useCountup(target: number, ms = 600): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduced) return;   // reduced motion renders the target directly
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, ms, reduced]);

  // reduced motion: jump to value (no animation state involved)
  return reduced ? target : value;
}

function Odometer({ label, usd, sub, color }: { label: React.ReactNode; usd: number; sub?: string; color?: string }) {
  const v = useCountup(usd);
  return (
    <div style={{
      flex: "1 1 150px", padding: "13px 15px", borderRadius: 12,
      background: T.inset, border: `1px solid ${T.border}`,
    }}>
      <p style={{ ...eyebrow, fontSize: 10, marginBottom: 5 }}>{label}</p>
      <p data-costmeter style={{ fontFamily: T.mono, fontSize: 19, fontWeight: 700, color: color ?? T.fg }}>
        ${v.toFixed(4)}
      </p>
      {sub && <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

export default function CostMeter() {
  const usage = usePipelineView(s => s.usage);
  const costDays = useRagStore(s => s.costDays);

  const embedCost = (usage.embedTokens * PRICING.embedInput) / 1e6;
  const genCost = (usage.promptTokens * PRICING.genInput + usage.completionTokens * PRICING.genOutput) / 1e6;
  const today = costDays[dayKey()] ?? 0;

  return (
    <div>
      <p style={{ ...eyebrow, marginBottom: 10 }}>
        <ConceptTrigger id="cost-economics">cost meter</ConceptTrigger> — real API spend
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Odometer label="session total" usd={usage.costUSD} color={T.green} sub="openai list pricing" />
        <Odometer label="↳ embeddings" usd={embedCost} sub={`${usage.embedTokens.toLocaleString()} tokens · the cheap rate`} />
        <Odometer label="↳ generation" usd={genCost} sub={`${(usage.promptTokens + usage.completionTokens).toLocaleString()} tokens · the premium rate`} />
        <Odometer label="today (all sessions)" usd={today} sub="persisted day ledger" />
      </div>
    </div>
  );
}
