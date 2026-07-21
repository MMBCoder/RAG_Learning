"use client";

import { useRagStore } from "../ragStore";
import { captureSnapshot, type RunKind } from "../store/eventsSlice";
import type { StageGate } from "./pipeline";

/* Recording (architecture F2): withRecording wraps ANY StageGate so that
   every run — manual, play-mode, or experiment — appends events to the
   log as a side effect of simply running. Recording is not a mode; it is
   how the pipeline runs. */

export function withRecording(gate: StageGate | undefined, runKind: RunKind): StageGate {
  let started = false;
  return {
    before: async (id) => {
      const s = useRagStore.getState();
      if (!started) {
        started = true;
        // a new DOCUMENT invalidates all prior snapshots (refs into old artifacts)
        if (runKind === "ingestion") s.clearEvents();
        // a new run always returns the view to live
        s.setScrub(null);
        s.recordEvent({
          t: performance.now(), runId: s.runId, kind: "run-start",
          runKind, stage: null, snapshot: captureSnapshot(s),
        });
      }
      await gate?.before?.(id);
    },
    after: async (id) => {
      const s = useRagStore.getState();
      s.recordEvent({
        t: performance.now(), runId: s.runId, kind: "stage-done", runKind,
        stage: id, ms: s.stages[id].ms, note: s.stages[id].note,
        snapshot: captureSnapshot(s),
      });
      await gate?.after?.(id);
    },
  };
}
