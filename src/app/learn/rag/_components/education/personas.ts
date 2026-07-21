import type { FeatureId, UiMode } from "../store/appTypes";

/* Persona system (architecture §A4): five audiences as configuration
   profiles over ONE component tree. Personas select copy voice, detail
   depth, featured/collapsed/hidden surfaces, and which metrics lead —
   never forked UIs. Components consume this only via usePersona(). */

export type PersonaId = "student" | "engineer" | "researcher" | "executive" | "presenter";

export type Voice = "analogy" | "technical" | "statistical" | "business" | "narrative";

export type MetricsLens = "learning" | "debugging" | "evaluation" | "roi" | "showtime";

export interface PersonaProfile {
  id: PersonaId;
  label: string;
  tagline: string;              // shown in the picker
  voice: Voice;
  /** 0 = outcomes only · 1 = guided · 2 = detailed · 3 = raw artifacts */
  depth: 0 | 1 | 2 | 3;
  featured: FeatureId[];
  collapsed: FeatureId[];
  hidden: FeatureId[];
  metricsLens: MetricsLens;
  defaultMode: UiMode;
  journeyEnabled: boolean;
}

export const PERSONAS: Record<PersonaId, PersonaProfile> = {
  student: {
    id: "student",
    label: "Student",
    tagline: "I'm new to RAG — teach me with analogies and animations.",
    voice: "analogy",
    depth: 1,
    featured: ["play-mode", "inspector", "journey"],
    collapsed: ["cost-meter"],
    hidden: [],
    metricsLens: "learning",
    defaultMode: "explore",
    journeyEnabled: true,
  },
  engineer: {
    id: "engineer",
    label: "AI Engineer",
    tagline: "Show me the artifacts, timings, prompts, and raw JSON.",
    voice: "technical",
    depth: 3,
    featured: ["inspector", "prompt-mri", "lab"],
    collapsed: [],
    hidden: [],
    metricsLens: "debugging",
    defaultMode: "explore",
    journeyEnabled: false,
  },
  researcher: {
    id: "researcher",
    label: "Researcher",
    tagline: "Evaluation metrics, retrieval statistics, and comparisons.",
    voice: "statistical",
    depth: 3,
    featured: ["radar", "playground", "cost-meter"],
    collapsed: [],
    hidden: [],
    metricsLens: "evaluation",
    defaultMode: "explore",
    journeyEnabled: false,
  },
  executive: {
    id: "executive",
    label: "Executive",
    tagline: "Skip the internals — show accuracy, latency, cost, and risk.",
    voice: "business",
    depth: 0,
    featured: ["cost-meter"],
    collapsed: ["pipeline-canvas", "inspector"],
    hidden: ["lab"],
    metricsLens: "roi",
    defaultMode: "explore",
    journeyEnabled: false,
  },
  presenter: {
    id: "presenter",
    label: "Presenter",
    tagline: "Fullscreen demos, cinematic playback, speaker notes.",
    voice: "narrative",
    depth: 1,
    featured: ["play-mode", "presentation"],
    collapsed: ["cost-meter"],
    hidden: [],
    metricsLens: "showtime",
    defaultMode: "explore",   // becomes "present" when Presentation Mode ships (M13)
    journeyEnabled: false,
  },
};

export const PERSONA_IDS = Object.keys(PERSONAS) as PersonaId[];

export const DEFAULT_PERSONA: PersonaId = "student";
