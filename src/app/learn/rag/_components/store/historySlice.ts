import type { StateCreator } from "zustand";
import { loadPersisted, savePersisted } from "../lib/persist";

/* History slice — M8 ships the cost ledger (day buckets) and the ROI
   card's editable assumptions; M11 adds the full per-chunk history.
   Costs are REAL (accumulated from actual API usage deltas); the ROI
   assumptions are the user's own, always visible on the card. */

const HISTORY_KEY = "history";
const HISTORY_VERSION = 1;

export interface RoiAssumptions {
  questionsPerMonth: number;
  minutesSavedPerQuestion: number;
  analystHourlyCost: number;
}

export const DEFAULT_ROI: RoiAssumptions = {
  questionsPerMonth: 2000,
  minutesSavedPerQuestion: 4,
  analystHourlyCost: 60,
};

interface PersistedHistory {
  costDays: Record<string, number>;
  roi: RoiAssumptions;
}

export const dayKey = (d = new Date()): string => d.toISOString().slice(0, 10);

export interface HistorySlice {
  historyHydrated: boolean;
  /** real spend per calendar day (UTC), accumulated from API usage */
  costDays: Record<string, number>;
  roiAssumptions: RoiAssumptions;

  hydrateHistory: () => void;
  addDayCost: (usd: number) => void;
  setRoiAssumption: <K extends keyof RoiAssumptions>(k: K, v: number) => void;
}

const persistHistory = (s: Pick<HistorySlice, "costDays" | "roiAssumptions">) =>
  savePersisted<PersistedHistory>(HISTORY_KEY, HISTORY_VERSION, {
    costDays: s.costDays, roi: s.roiAssumptions,
  });

export const createHistorySlice: StateCreator<HistorySlice, [], [], HistorySlice> = (set, get) => ({
  historyHydrated: false,
  costDays: {},
  roiAssumptions: { ...DEFAULT_ROI },

  hydrateHistory: () => {
    const saved = loadPersisted<PersistedHistory | null>(HISTORY_KEY, HISTORY_VERSION, null);
    set({
      historyHydrated: true,
      ...(saved ? { costDays: saved.costDays, roiAssumptions: saved.roi } : {}),
    });
  },

  addDayCost: (usd) => {
    if (!(usd > 0)) return;
    const key = dayKey();
    const costDays = { ...get().costDays, [key]: (get().costDays[key] ?? 0) + usd };
    set({ costDays });
    persistHistory(get());
  },

  setRoiAssumption: (k, v) => {
    if (!Number.isFinite(v) || v < 0) return;
    set({ roiAssumptions: { ...get().roiAssumptions, [k]: v } });
    persistHistory(get());
  },
});
