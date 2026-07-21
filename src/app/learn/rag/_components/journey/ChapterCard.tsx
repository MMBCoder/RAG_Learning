"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Check, X } from "lucide-react";
import { useRagStore } from "../ragStore";
import { useJourney } from "./useJourney";
import { CHAPTERS } from "./curriculum";
import { CONCEPTS } from "../education/concepts";
import { ConceptTrigger } from "../education/ConceptCard";
import { T, DEPTH, eyebrow } from "../theme";

/* The journey's voice: one dismissible card explaining the current
   chapter's goal and the concrete action that completes it. Never modal,
   never blocking — explorers who ignore it lose nothing. */

export default function ChapterCard({ isMobile }: { isMobile: boolean }) {
  const journey = useJourney();
  const dismissed = useRagStore(s => s.journeyCardDismissed);
  const dismissCard = useRagStore(s => s.dismissChapterCard);
  const restart = useRagStore(s => s.restartJourney);
  const setOverride = useRagStore(s => s.setJourneyOverride);
  const completedList = useRagStore(s => s.journeyCompleted);
  const activeMoment = useRagStore(s => s.activeMoment);

  // celebration flash when a chapter completes — but not on hydration,
  // when persisted progress arrives all at once (render-time adjustment)
  const count = journey.completedCount;
  const [lastCount, setLastCount] = useState(count);
  const [lastHydrated, setLastHydrated] = useState(journey.hydrated);
  const [celebrate, setCelebrate] = useState(false);
  if (journey.hydrated !== lastHydrated) {
    setLastHydrated(journey.hydrated);
    setLastCount(count);
  } else if (count !== lastCount) {
    setLastCount(count);
    if (count > lastCount && journey.enabled) setCelebrate(true);
  }
  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(false), 3200);
    return () => clearTimeout(t);
  }, [celebrate]);

  const cur = journey.current;
  const lastDoneId = completedList[completedList.length - 1];
  const lastDone = lastDoneId ? CHAPTERS.find(c => c.id === lastDoneId) : undefined;

  const show =
    journey.enabled &&
    (celebrate || (cur !== null && !dismissed.includes(cur.id))) &&
    !(isMobile && activeMoment);   // moments get the mobile slot; card returns after

  const lead = cur?.conceptIds[0];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="region"
          aria-label={cur ? `Learning journey — ${cur.title}` : "Learning journey complete"}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed", left: isMobile ? 10 : 24,
            bottom: isMobile ? 92 : 24, zIndex: 72,
            width: isMobile ? "calc(100vw - 20px)" : 380,
            background: T.panel, border: "1px solid rgba(5,150,105,0.4)",
            borderRadius: 14, padding: "14px 16px",
            boxShadow: `${DEPTH.floating}, ${DEPTH.innerHighlight}`,
          }}
        >
          <AnimatePresence>
            {celebrate && lastDone && (
              <motion.p
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
                  padding: "7px 11px", borderRadius: 9,
                  background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.4)",
                  fontFamily: T.mono, fontSize: 11.5, fontWeight: 600, color: T.green,
                }}
              >
                <Check size={13} /> chapter complete — {lastDone.title.toLowerCase()}
              </motion.p>
            )}
          </AnimatePresence>

          {cur ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ ...eyebrow, fontSize: 10.5, color: T.green, display: "flex", alignItems: "center", gap: 6 }}>
                  <Compass size={13} /> learning journey · chapter {journey.currentIndex} of {journey.total}
                </p>
                <button onClick={() => dismissCard(cur.id)} aria-label="Dismiss chapter card"
                  style={{ all: "unset", cursor: "pointer", color: T.fgMuted, display: "flex" }}>
                  <X size={14} />
                </button>
              </div>

              <h4 style={{ fontFamily: T.disp, fontWeight: 800, fontSize: 15.5, color: T.fg, letterSpacing: "-0.02em", textTransform: "lowercase", marginBottom: 6 }}>
                {cur.title}
              </h4>
              <p style={{ fontSize: 12.5, lineHeight: 1.65, color: T.fgSec, marginBottom: 8 }}>
                {cur.goal}
              </p>
              <p style={{ fontSize: 12.5, lineHeight: 1.6, color: T.fg, marginBottom: 10 }}>
                <span style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: T.green, fontWeight: 600 }}>try it · </span>
                {cur.hint}
              </p>

              {lead && (
                <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgMuted, marginBottom: 12 }}>
                  concept: <ConceptTrigger id={lead}>{CONCEPTS[lead].term}</ConceptTrigger>
                </p>
              )}

              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => dismissCard(cur.id)} style={footerLink}>skip for now</button>
                {journey.completedCount > 0 && (
                  <button onClick={restart} style={footerLink}>restart journey</button>
                )}
                <button onClick={() => setOverride("off")} style={footerLink}>turn off journey</button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12.5, lineHeight: 1.65, color: T.fgSec }}>
              That was the whole journey — the pipeline is yours now. Every dial, node, and score you just met stays live for free exploration.
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const footerLink: React.CSSProperties = {
  all: "unset", cursor: "pointer", fontFamily: T.mono, fontSize: 11,
  color: T.fgMuted, borderBottom: "1px dotted rgba(100,116,139,0.6)",
};
