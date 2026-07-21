"use client";

import { create } from "zustand";
import { createPipelineSlice, type PipelineSlice } from "./store/pipelineSlice";
import { createUiSlice, type UiSlice } from "./store/uiSlice";
import { createJourneySlice, type JourneySlice } from "./store/journeySlice";
import { createEventsSlice, type EventsSlice } from "./store/eventsSlice";
import { createHistorySlice, type HistorySlice } from "./store/historySlice";
import { createCompareSlice, type CompareSlice } from "./store/compareSlice";

/* Composed store. M0 established the slice pattern; V2 slices (events,
   history, compare, coach) join this intersection as they land. */

export type RagStore = PipelineSlice & UiSlice & JourneySlice & EventsSlice & HistorySlice & CompareSlice;

export const useRagStore = create<RagStore>()((...a) => ({
  ...createPipelineSlice(...a as Parameters<typeof createPipelineSlice>),
  ...createUiSlice(...a as Parameters<typeof createUiSlice>),
  ...createJourneySlice(...a as Parameters<typeof createJourneySlice>),
  ...createEventsSlice(...a as Parameters<typeof createEventsSlice>),
  ...createHistorySlice(...a as Parameters<typeof createHistorySlice>),
  ...createCompareSlice(...a as Parameters<typeof createCompareSlice>),
}));

/* Real spend flows into the day ledger as a store-level effect: every
   usage delta lands in today's bucket no matter which surface caused it. */
useRagStore.subscribe((s, prev) => {
  const delta = s.usage.costUSD - prev.usage.costUSD;
  if (delta > 0) s.addDayCost(delta);
});

/* Public API unchanged: every existing `import { … } from "./ragStore"`
   keeps working — types and constants are re-exported from the slice layer. */

export * from "./store/types";
export * from "./store/appTypes";
