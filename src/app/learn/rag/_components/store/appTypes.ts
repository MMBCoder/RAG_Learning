/* App-level identifiers shared across V2 slices and surfaces.
   (Established in M0; consumed from M1 onward.) */

/** Top-level UI mode — one focused surface at a time (see architecture §15.5). */
export type UiMode =
  | "explore"
  | "play"
  | "present"
  | "detective"
  | "brain"
  | "compare";

/** Every V2 feature surface. Personas feature/collapse/hide these; the
    educational-objective map must cover every one of them (CI-enforced). */
export type FeatureId =
  | "pipeline-canvas"
  | "inspector"
  | "play-mode"
  | "timeline"
  | "universe"
  | "detective"
  | "brain"
  | "prompt-mri"
  | "context-window"
  | "cost-meter"
  | "playground"
  | "lab"
  | "coach"
  | "radar"
  | "chunk-story"
  | "heatmap"
  | "presentation"
  | "journey"
  | "sound";
