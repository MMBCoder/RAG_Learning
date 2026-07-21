import type { StateCreator } from "zustand";
import { loadPersisted, savePersisted } from "../lib/persist";
import type { ChapterId } from "../journey/curriculum";

/* Journey slice (M2): chapter completion, card dismissals, on/off
   override, and session soft-gate state. Progress persists via
   lib/persist; hydration happens post-mount alongside hydrateUi so
   server and first client render match. */

const JOURNEY_KEY = "journey";
const JOURNEY_VERSION = 1;

/** null → the persona's journeyEnabled default decides. */
export type JourneyOverride = "on" | "off" | null;

interface PersistedJourney {
  completed: ChapterId[];
  dismissed: ChapterId[];
  override: JourneyOverride;
}

export interface JourneySlice {
  journeyHydrated: boolean;
  journeyCompleted: ChapterId[];      // completion order preserved
  journeyCardDismissed: ChapterId[];  // chapter cards the user closed
  journeyOverride: JourneyOverride;
  journeyResetCount: number;          // bump → detection tracker restarts (session)
  journeyGateOpened: ChapterId[];     // soft-gates opened early via "open now" (session)

  hydrateJourney: () => void;
  completeChapter: (id: ChapterId) => void;
  dismissChapterCard: (id: ChapterId) => void;
  reopenChapterCard: (id: ChapterId) => void;
  setJourneyOverride: (v: JourneyOverride) => void;
  restartJourney: () => void;
  openJourneyGate: (id: ChapterId) => void;
}

const persistJourney = (
  s: Pick<JourneySlice, "journeyCompleted" | "journeyCardDismissed" | "journeyOverride">,
) =>
  savePersisted<PersistedJourney>(JOURNEY_KEY, JOURNEY_VERSION, {
    completed: s.journeyCompleted,
    dismissed: s.journeyCardDismissed,
    override: s.journeyOverride,
  });

export const createJourneySlice: StateCreator<JourneySlice, [], [], JourneySlice> = (set, get) => ({
  journeyHydrated: false,
  journeyCompleted: [],
  journeyCardDismissed: [],
  journeyOverride: null,
  journeyResetCount: 0,
  journeyGateOpened: [],

  hydrateJourney: () => {
    const saved = loadPersisted<PersistedJourney | null>(JOURNEY_KEY, JOURNEY_VERSION, null);
    set({
      journeyHydrated: true,
      ...(saved ? {
        journeyCompleted: saved.completed,
        journeyCardDismissed: saved.dismissed,
        journeyOverride: saved.override,
      } : {}),
    });
  },

  completeChapter: (id) => {
    const s = get();
    if (s.journeyCompleted.includes(id)) return;
    set({ journeyCompleted: [...s.journeyCompleted, id] });
    persistJourney(get());
  },

  dismissChapterCard: (id) => {
    const s = get();
    if (s.journeyCardDismissed.includes(id)) return;
    set({ journeyCardDismissed: [...s.journeyCardDismissed, id] });
    persistJourney(get());
  },

  reopenChapterCard: (id) => {
    set({ journeyCardDismissed: get().journeyCardDismissed.filter(d => d !== id) });
    persistJourney(get());
  },

  setJourneyOverride: (v) => {
    set({ journeyOverride: v });
    persistJourney(get());
  },

  restartJourney: () => {
    set({
      journeyCompleted: [],
      journeyCardDismissed: [],
      journeyGateOpened: [],
      journeyResetCount: get().journeyResetCount + 1,
    });
    persistJourney(get());
  },

  openJourneyGate: (id) => {
    const s = get();
    if (s.journeyGateOpened.includes(id)) return;
    set({ journeyGateOpened: [...s.journeyGateOpened, id] });
  },
});
