"use client";

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "../lib/persist";

/* Sound (F17): synthesized WebAudio cues mapped to grammar tokens —
   settle, shake, beat. OFF by default, persisted, fully redundant
   (every cue doubles information that is already visible), and the
   AudioContext is created only after a user gesture enables it. */

export type SoundCue = "settle" | "shake" | "beat";

const KEY = "sound";
const VERSION = 1;

/** cue → [frequency Hz, duration s, type] — short, quiet, non-musical */
const CUES: Record<SoundCue, [number, number, OscillatorType]> = {
  settle: [660, 0.09, "sine"],     // work completed
  shake: [140, 0.18, "square"],    // something failed
  beat: [440, 0.06, "triangle"],   // narration beat advanced
};

let enabled = false;
let hydrated = false;
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  enabled = loadPersisted<boolean>(KEY, VERSION, false);
}

export const soundStore = {
  subscribe(cb: () => void): () => void {
    hydrate();
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  isEnabled(): boolean {
    hydrate();
    return enabled;
  },
  toggle(): void {
    hydrate();
    enabled = !enabled;
    savePersisted(KEY, VERSION, enabled);
    if (enabled && !ctx && typeof window !== "undefined" && "AudioContext" in window) {
      ctx = new AudioContext();   // created on the enabling gesture
    }
    emit();
  },
  play(cue: SoundCue): void {
    if (!enabled || !ctx || ctx.state === "closed") return;
    try {
      const [freq, dur, type] = CUES[cue];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* audio is never load-bearing */ }
  },
};

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(soundStore.subscribe, soundStore.isEnabled, () => false);
}

/* grammar-mapped cues: settle on stage done, shake on error, beat on
   narration advance — wired once, fire only while sound is enabled */
let cuesInit = false;

export function initSoundCues(): void {
  if (cuesInit || typeof window === "undefined") return;
  cuesInit = true;
  void import("../ragStore").then(({ useRagStore, STAGE_IDS }) => {
    useRagStore.subscribe((s, prev) => {
      if (!enabled) return;
      if (s.play.active && s.play.step !== prev.play.step) soundStore.play("beat");
      for (const id of STAGE_IDS) {
        const was = prev.stages[id].status;
        const now = s.stages[id].status;
        if (was === now) continue;
        if (now === "done") { soundStore.play("settle"); break; }
        if (now === "error") { soundStore.play("shake"); break; }
      }
    });
  });
}
