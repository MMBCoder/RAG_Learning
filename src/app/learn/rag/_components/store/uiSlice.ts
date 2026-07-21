import type { StateCreator } from "zustand";
import { DEFAULT_PERSONA, type PersonaId } from "../education/personas";
import { loadPersisted, savePersisted } from "../lib/persist";
import type { RagParams, StageId } from "./types";

/* UI slice (M1): persona, learning moments, dock routing, param pulses.
   Persona + dismissals persist via lib/persist. Hydration happens in a
   post-mount effect (hydrateUi) so server and first client render match. */

const UI_KEY = "ui";
const UI_VERSION = 1;

interface PersistedUi {
  persona: PersonaId;
  personaChosen: boolean;
  dismissedMoments: string[];
}

export type DockTab = "params" | "metrics" | "playground" | "lab";

export interface ActiveMoment { id: string; text: string; conceptId?: string; }

export interface UiSlice {
  persona: PersonaId;
  personaChosen: boolean;     // false → first-visit welcome picker
  uiHydrated: boolean;        // true once localStorage has been read (client)
  dismissedMoments: string[]; // learning-moment rule ids the user said "got it" to
  activeMoment: ActiveMoment | null;
  dockTab: DockTab;
  paramPulse: keyof RagParams | null;  // slider to flash after a "adjust it →" jump
  /** Director's spotlight (grammar: recede) — all nodes but this one dim. */
  spotlightStage: StageId | null;
  /** Evidence Detective (M9): open walk anchored to an answer sentence. */
  detectiveSentence: number | null;
  /** latched when a walk reaches the source step (feeds journey ch. 4) */
  detectiveTraced: boolean;
  /** Inside GPT's Brain (M10) */
  brainOpen: boolean;
  /** live stream telemetry: TTFT and delta cadence, measured (M10) */
  brainStats: { startedAt: number; firstTokenAt: number | null; lastDeltaAt: number | null; deltas: number } | null;
  /** Chunk Life Story (M11): chunk id whose profile is open */
  profileChunk: number | null;
  /** Presentation shell (M13) */
  presentationOpen: boolean;

  hydrateUi: () => void;
  setPersona: (p: PersonaId) => void;
  showMoment: (m: ActiveMoment) => void;
  dismissMoment: () => void;  // user said "got it" — remember permanently
  clearMoment: () => void;    // auto-hide — may fire again another session
  setDockTab: (t: DockTab) => void;
  pulseParam: (k: keyof RagParams | null) => void;
  setSpotlight: (id: StageId | null) => void;
  openDetective: (sentence: number) => void;
  closeDetective: () => void;
  markDetectiveTraced: () => void;
  setBrainOpen: (open: boolean) => void;
  openChunkProfile: (id: number) => void;
  closeChunkProfile: () => void;
  setPresentationOpen: (open: boolean) => void;
}

const persistUi = (s: Pick<UiSlice, "persona" | "personaChosen" | "dismissedMoments">) =>
  savePersisted<PersistedUi>(UI_KEY, UI_VERSION, {
    persona: s.persona, personaChosen: s.personaChosen, dismissedMoments: s.dismissedMoments,
  });

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set, get) => ({
  persona: DEFAULT_PERSONA,
  personaChosen: false,
  uiHydrated: false,
  dismissedMoments: [],
  activeMoment: null,
  dockTab: "params",
  paramPulse: null,
  spotlightStage: null,
  detectiveSentence: null,
  detectiveTraced: false,
  brainOpen: false,
  brainStats: null,
  profileChunk: null,
  presentationOpen: false,

  hydrateUi: () => {
    const saved = loadPersisted<PersistedUi | null>(UI_KEY, UI_VERSION, null);
    set({
      uiHydrated: true,
      ...(saved ? {
        persona: saved.persona,
        personaChosen: saved.personaChosen,
        dismissedMoments: saved.dismissedMoments,
      } : {}),
    });
  },

  setPersona: (p) => {
    set({ persona: p, personaChosen: true });
    persistUi(get());
  },

  showMoment: (m) => {
    const s = get();
    if (s.dismissedMoments.includes(m.id)) return;
    set({ activeMoment: m });
  },

  dismissMoment: () => {
    const s = get();
    if (!s.activeMoment) return;
    set({
      dismissedMoments: [...s.dismissedMoments, s.activeMoment.id],
      activeMoment: null,
    });
    persistUi(get());
  },

  clearMoment: () => set({ activeMoment: null }),

  setDockTab: (t) => set({ dockTab: t }),
  pulseParam: (k) => set({ paramPulse: k }),
  setSpotlight: (id) => set({ spotlightStage: id }),
  openDetective: (sentence) => set({ detectiveSentence: sentence }),
  closeDetective: () => set({ detectiveSentence: null }),
  markDetectiveTraced: () => set({ detectiveTraced: true }),
  setBrainOpen: (open) => set({ brainOpen: open }),
  openChunkProfile: (id) => set({ profileChunk: id }),
  closeChunkProfile: () => set({ profileChunk: null }),
  setPresentationOpen: (open) => set({ presentationOpen: open }),
});
