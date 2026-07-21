"use client";

import { useEffect, useRef } from "react";
import { useRagStore } from "../ragStore";
import { PERSONAS } from "../education/personas";
import {
  ACTIVE_CHAPTERS, advanceTrack, emptyTrack,
  type Chapter, type ChapterId,
} from "./curriculum";

/* The ONLY sanctioned way components read journey state (mirrors
   usePersona). Detection lives separately in useJourneyDetection(),
   mounted ONCE in RagShell — reading components stay side-effect free. */

export interface JourneyState {
  /** effective on/off: user override, else the persona's default */
  enabled: boolean;
  hydrated: boolean;
  chapters: Chapter[];          // active chapters, in order
  current: Chapter | null;      // first incomplete; null once all done
  currentIndex: number;         // 1-based among active chapters (0 when done)
  total: number;
  completedCount: number;
  allDone: boolean;
  isComplete: (id: ChapterId) => boolean;
  /** soft gate: true while the surface should render folded (never locked) */
  isGated: (id: ChapterId) => boolean;
}

export function useJourney(): JourneyState {
  const persona = useRagStore(s => s.persona);
  const override = useRagStore(s => s.journeyOverride);
  const hydrated = useRagStore(s => s.journeyHydrated && s.uiHydrated);
  const completed = useRagStore(s => s.journeyCompleted);
  const gateOpened = useRagStore(s => s.journeyGateOpened);

  // journey UI appears only post-hydration so server and first paint match
  const enabled = hydrated && (override !== null ? override === "on" : PERSONAS[persona].journeyEnabled);
  const chapters = ACTIVE_CHAPTERS;
  const current = chapters.find(c => !completed.includes(c.id)) ?? null;
  const completedCount = chapters.filter(c => completed.includes(c.id)).length;

  return {
    enabled,
    hydrated,
    chapters,
    current,
    currentIndex: current ? chapters.indexOf(current) + 1 : 0,
    total: chapters.length,
    completedCount,
    allDone: completedCount === chapters.length,
    isComplete: id => completed.includes(id),
    isGated: id => {
      if (!enabled) return false;
      if (gateOpened.includes(id) || completed.includes(id)) return false;
      // the gate lifts the moment the learner's journey reaches the chapter
      const gateIdx = chapters.findIndex(c => c.id === id);
      return current !== null && gateIdx > chapters.indexOf(current);
    },
  };
}

/** Watches real store transitions and completes chapters from them.
    Mounted once (RagShell). Runs even while the journey UI is off, so a
    learner who enables it later sees the progress their real actions
    already earned. */
export function useJourneyDetection(): void {
  const trackRef = useRef(emptyTrack());
  const lastResetRef = useRef(0);

  const ingested = useRagStore(s => s.ingested);
  const answer = useRagStore(s => s.answer);
  const selected = useRagStore(s => s.selected);
  const playActive = useRagStore(s => s.play.active);
  const detectiveTraced = useRagStore(s => s.detectiveTraced);
  const labRuns = useRagStore(s => s.labRuns);
  const comparedRuns = useRagStore(s => s.comparedRuns);
  const params = useRagStore(s => s.params);
  const resetCount = useRagStore(s => s.journeyResetCount);

  useEffect(() => {
    if (resetCount !== lastResetRef.current) {
      lastResetRef.current = resetCount;
      trackRef.current = emptyTrack();   // restart: signals re-derive from live state
    }
    trackRef.current = advanceTrack(trackRef.current, { ingested, answer, selected, playActive, detectiveTraced, labRuns, comparedRuns, params });
    const sig = trackRef.current.signals;
    const store = useRagStore.getState();
    for (const ch of ACTIVE_CHAPTERS) {
      if (store.journeyCompleted.includes(ch.id)) continue;
      if (ch.isComplete(sig)) store.completeChapter(ch.id);
    }
  }, [ingested, answer, selected, playActive, detectiveTraced, labRuns, comparedRuns, params, resetCount]);
}
