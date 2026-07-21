"use client";

import { useRagStore } from "../ragStore";
import { PERSONAS, type PersonaProfile } from "./personas";
import type { FeatureId } from "../store/appTypes";

/* The ONLY sanctioned way components read persona configuration.
   No `if (persona === "student")` scattered through views — consume
   voice/depth/lens/flags from here so persona logic stays in one place. */

export interface PersonaView {
  id: PersonaProfile["id"];
  profile: PersonaProfile;
  voice: PersonaProfile["voice"];
  depth: PersonaProfile["depth"];
  lens: PersonaProfile["metricsLens"];
  isFeatured: (f: FeatureId) => boolean;
  isCollapsed: (f: FeatureId) => boolean;
  isHidden: (f: FeatureId) => boolean;
  /** raw-artifact surfaces (JSON tabs, vector dumps) */
  showRawData: boolean;
}

export function usePersona(): PersonaView {
  const persona = useRagStore(s => s.persona);
  const profile = PERSONAS[persona];
  return {
    id: profile.id,
    profile,
    voice: profile.voice,
    depth: profile.depth,
    lens: profile.metricsLens,
    isFeatured: f => profile.featured.includes(f),
    isCollapsed: f => profile.collapsed.includes(f),
    isHidden: f => profile.hidden.includes(f),
    showRawData: profile.depth >= 3,
  };
}
