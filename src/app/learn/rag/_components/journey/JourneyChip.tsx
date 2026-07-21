"use client";

import { Check } from "lucide-react";
import { useRagStore } from "../ragStore";
import { useJourney } from "./useJourney";
import { T } from "../theme";

/* Slim header chip: progress ring + current chapter. Clicking toggles the
   chapter card — the journey's one always-visible, always-ignorable handle. */

function ProgressRing({ fraction }: { fraction: number }) {
  const r = 6.5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={17} height={17} viewBox="0 0 17 17" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx={8.5} cy={8.5} r={r} fill="none" stroke="rgba(5,150,105,0.2)" strokeWidth={2.5} />
      <circle
        cx={8.5} cy={8.5} r={r} fill="none"
        stroke={T.green} strokeWidth={2.5} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - fraction)}
        transform="rotate(-90 8.5 8.5)"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

export default function JourneyChip() {
  const journey = useJourney();
  const dismissed = useRagStore(s => s.journeyCardDismissed);
  const dismissCard = useRagStore(s => s.dismissChapterCard);
  const reopenCard = useRagStore(s => s.reopenChapterCard);

  if (!journey.enabled) return null;

  const cur = journey.current;
  const cardVisible = cur !== null && !dismissed.includes(cur.id);

  return (
    <button
      onClick={() => {
        if (!cur) return;
        if (cardVisible) dismissCard(cur.id);
        else reopenCard(cur.id);
      }}
      aria-label={cur
        ? `Learning journey — chapter ${journey.currentIndex} of ${journey.total}: ${cur.title}`
        : "Learning journey complete"}
      aria-expanded={cardVisible}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "11px 15px",
        borderRadius: 11, cursor: cur ? "pointer" : "default", whiteSpace: "nowrap",
        background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.4)",
        fontFamily: T.mono, fontSize: 12.5, fontWeight: 600, color: T.green,
      }}
    >
      <ProgressRing fraction={journey.total === 0 ? 0 : journey.completedCount / journey.total} />
      {cur
        ? `${journey.currentIndex}/${journey.total} · ${cur.title.toLowerCase()}`
        : <>journey complete <Check size={13} /></>}
    </button>
  );
}
