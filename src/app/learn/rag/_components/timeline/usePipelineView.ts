"use client";

import { useRagStore, type RagStore } from "../ragStore";

/* ═══════════════════════════════════════════════════════════════════
   PROJECTION, NOT MUTATION (architecture F2).

   Scrubbing derives a read-only view from the event log — the live
   store is NEVER rewound. Visualization components read artifacts
   through usePipelineView(); while scrubbing they transparently see the
   snapshot at the scrub position, and the moment scrub clears they see
   live state again. Parameters, selection, hover, and all actions stay
   on the live store on purpose: params always edit live state.
   ═══════════════════════════════════════════════════════════════════ */

let lastState: RagStore | null = null;
let lastProjected: RagStore | null = null;

/** Live state, or live state overlaid with the scrubbed snapshot.
    Memoized per store snapshot so every selector shares one merge and
    referential stability holds for useSyncExternalStore. */
export function projectedState(s: RagStore): RagStore {
  if (s.scrubSeq === null) return s;
  if (s === lastState && lastProjected) return lastProjected;
  let ev = null;
  for (let i = s.events.length - 1; i >= 0; i--) {
    if (s.events[i].seq <= s.scrubSeq) { ev = s.events[i]; break; }
  }
  lastState = s;
  lastProjected = ev ? { ...s, ...ev.snapshot } : s;
  return lastProjected;
}

/** Drop-in replacement for useRagStore in visualization components. */
export function usePipelineView<T>(selector: (s: RagStore) => T): T {
  return useRagStore(s => selector(projectedState(s)));
}

/** True while the user is viewing history instead of the live pipeline. */
export function useIsScrubbing(): boolean {
  return useRagStore(s => s.scrubSeq !== null);
}
