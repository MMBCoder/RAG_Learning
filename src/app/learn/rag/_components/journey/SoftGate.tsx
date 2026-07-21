"use client";

import { Unlock } from "lucide-react";
import { useRagStore } from "../ragStore";
import { useJourney } from "./useJourney";
import { type ChapterId, ACTIVE_CHAPTERS } from "./curriculum";
import { T, eyebrow } from "../theme";

/* Progressive disclosure, museum rules: nothing is ever locked. A gated
   surface renders folded with its unlock chapter named and a one-click
   "open now" — the journey rations attention, never access. */

export default function SoftGate({
  chapterId, surface, children,
}: {
  chapterId: ChapterId;
  /** short human name of what's folded, e.g. "parameters & metrics" */
  surface: string;
  children: React.ReactNode;
}) {
  const journey = useJourney();
  const openGate = useRagStore(s => s.openJourneyGate);

  if (!journey.isGated(chapterId)) return <>{children}</>;

  const idx = ACTIVE_CHAPTERS.findIndex(c => c.id === chapterId);
  const ch = ACTIVE_CHAPTERS[idx];

  return (
    <div style={{
      background: T.panel, border: `1px dashed ${T.borderStrong}`, borderRadius: 18,
      padding: "18px 22px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
    }}>
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <p style={{ ...eyebrow, fontSize: 11, marginBottom: 4 }}>{surface}</p>
        <p style={{ fontSize: 12.5, color: T.fgSec, lineHeight: 1.6 }}>
          unlocks in chapter {idx + 1} — {ch.title.toLowerCase()}
        </p>
      </div>
      <button
        onClick={() => openGate(chapterId)}
        style={{
          display: "flex", alignItems: "center", gap: 7, padding: "9px 15px",
          borderRadius: 10, cursor: "pointer",
          background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.4)",
          fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.green,
        }}
      >
        <Unlock size={13} /> or open now →
      </button>
    </div>
  );
}
