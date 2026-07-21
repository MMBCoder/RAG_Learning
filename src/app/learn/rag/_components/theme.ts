/* Light "editorial lab" theme — matches the site's design language:
   light grey page (#F1F2F4 like /learn), white panels, #E8E8E8-family borders,
   Space Grotesk display + JetBrains Mono labels, blue #2563EB accent. */

export const T = {
  bg: "#F1F2F4",
  bgRaised: "#FFFFFF",
  panel: "#FFFFFF",
  panelHover: "#F7F8FA",
  inset: "#F5F6F8",            // inner wells: snippets, inputs, code
  border: "#E4E6EB",
  borderStrong: "#D3D7DE",
  /* accent TEXT tokens are AA-audited (≥4.5:1) against panel/inset —
     hardened in M13's axe pass; decorative rgba borders keep the
     brighter hues, which contrast rules don't govern */
  fg: "#111111",
  fgSec: "#3F4754",
  fgMuted: "#5B626E",
  blue: "#2563EB",
  violet: "#7C3AED",
  green: "#047857",
  amber: "#B45309",
  red: "#B91C1C",
  cyan: "#0E7490",
  grad: "linear-gradient(135deg, #2563EB, #7C3AED)",
  gradText: { background: "linear-gradient(90deg, #2563EB, #7C3AED)", WebkitBackgroundClip: "text" as const, WebkitTextFillColor: "transparent" as const },
  mono: "var(--font-jetbrains-mono), monospace",
  disp: "var(--font-space-grotesk), sans-serif",
  cardShadow: "0 2px 10px rgba(15,23,42,0.05)",
  glass: {
    background: "#FFFFFF",
    border: "1px solid #E4E6EB",
    borderRadius: 14,
  },
};

export const eyebrow: React.CSSProperties = {
  fontFamily: T.mono, fontSize: 12, letterSpacing: "0.16em",
  textTransform: "uppercase", color: T.fgMuted,
};

/* ── V2 depth tokens (M0 foundation — adopted feature by feature) ──
   Layered elevation within the light editorial language: soft stacked
   shadows + a 1px inner highlight give "museum glass" depth without
   abandoning the site's flat, readable look. */
export const DEPTH = {
  raised: "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.06)",
  floating: "0 2px 6px rgba(15,23,42,0.06), 0 12px 34px rgba(15,23,42,0.10)",
  overlay: "0 8px 20px rgba(15,23,42,0.10), 0 28px 70px rgba(15,23,42,0.18)",
  innerHighlight: "inset 0 1px 0 rgba(255,255,255,0.85)",
  sweep: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", // settle light-sweep
};

/* ── Cinema palette (Presentation Mode ONLY — the one sanctioned dark
   context; every pair AA-audited against its background before use). ── */
export const CINEMA = {
  bg: "#0B0D12",
  panel: "#151823",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.22)",
  fg: "#F2F4F8",
  fgSec: "#B7BECC",
  fgMuted: "#8A93A6",
  blue: "#5B8DEF",
  violet: "#A78BFA",
  green: "#34D399",
  amber: "#FBBF24",
  red: "#F87171",
  grad: "linear-gradient(135deg, #5B8DEF, #A78BFA)",
  overlayShadow: "0 24px 80px rgba(0,0,0,0.6)",
};
