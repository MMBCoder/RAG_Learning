"use client";

import { ShieldAlert } from "lucide-react";
import { T } from "../theme";

/* The honesty contract (architecture F18): this badge is visible in
   EVERY brain state. The feature visualizes observable stages only —
   prompt in, tokens out, citations, assembly. It never implies access
   to the model's hidden reasoning or chain of thought. */

export default function SimulationBadge() {
  return (
    <div
      data-simulation-badge
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "8px 13px", borderRadius: 10,
        background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.5)",
      }}
    >
      <ShieldAlert size={14} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontFamily: T.mono, fontSize: 10.5, lineHeight: 1.55, color: T.amber, fontWeight: 600 }}>
        EDUCATIONAL SIMULATION — you are watching the model&apos;s observable inputs and outputs
        (prompt, token stream, citations), not its hidden reasoning. No one can see that.
      </p>
    </div>
  );
}
