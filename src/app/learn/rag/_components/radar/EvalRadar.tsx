"use client";

import type { EvalScores } from "../ragStore";
import { ConceptTrigger } from "../education/ConceptCard";
import { T } from "../theme";

/* Hallucination Radar (F13): the five judge scores as one readable
   shape. Risk is plotted INVERTED and says so on the axis — outer edge
   always means "better", so the shape reads at a glance without lying
   about what the number is. */

export interface RadarAxis { label: string; value: number; }

/** Pure polygon geometry — unit-tested. Values are 0–100, radius r. */
export function radarPoints(values: number[], cx: number, cy: number, r: number): string {
  const n = values.length;
  return values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (Math.max(0, Math.min(100, v)) / 100) * r;
    return `${(cx + Math.cos(angle) * rr).toFixed(2)},${(cy + Math.sin(angle) * rr).toFixed(2)}`;
  }).join(" ");
}

export function radarAxes(ev: EvalScores): RadarAxis[] {
  return [
    { label: "faithfulness", value: ev.faithfulness },
    { label: "relevance", value: ev.answerRelevance },
    { label: "precision", value: ev.contextPrecision },
    { label: "recall", value: ev.contextRecall },
    { label: "safety (100−risk)", value: 100 - ev.hallucinationRisk },
  ];
}

export default function EvalRadar({
  scores, overlay, size = 240,
}: {
  scores: EvalScores;
  /** second polygon (dashed) for A/B comparison — A = overlay, B = scores */
  overlay?: EvalScores | null;
  size?: number;
}) {
  const axes = radarAxes(scores);
  const overlayAxes = overlay ? radarAxes(overlay) : null;
  const cx = size / 2, cy = size / 2, r = size * 0.36;

  return (
    <div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`Evaluation radar: ${axes.map(a => `${a.label} ${a.value}`).join(", ")}`}>
        {/* grid rings */}
        {[25, 50, 75, 100].map(g => (
          <polygon
            key={g}
            points={radarPoints(axes.map(() => g), cx, cy, r)}
            fill="none" stroke="rgba(15,23,42,0.09)" strokeWidth={1}
          />
        ))}
        {/* spokes + labels */}
        {axes.map((a, i) => {
          const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
          const lx = cx + Math.cos(angle) * (r + 16);
          const ly = cy + Math.sin(angle) * (r + 16);
          return (
            <g key={a.label}>
              <line x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r}
                stroke="rgba(15,23,42,0.09)" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                style={{ font: `600 8.5px ${T.mono}`, fill: T.fgSec, letterSpacing: "0.04em" }}>
                {a.label} {a.value}
              </text>
            </g>
          );
        })}
        {/* A's shape (dashed) under B's when comparing */}
        {overlayAxes && (
          <polygon
            points={radarPoints(overlayAxes.map(a => a.value), cx, cy, r)}
            fill="rgba(37,99,235,0.08)" stroke={T.blue} strokeWidth={1.5}
            strokeDasharray="5 4" strokeLinejoin="round"
          />
        )}
        {/* the shape itself */}
        <polygon
          points={radarPoints(axes.map(a => a.value), cx, cy, r)}
          fill="rgba(124,58,237,0.14)" stroke={T.violet} strokeWidth={2} strokeLinejoin="round"
        />
        {axes.map((a, i) => {
          const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
          const rr = (a.value / 100) * r;
          return <circle key={a.label} cx={cx + Math.cos(angle) * rr} cy={cy + Math.sin(angle) * rr} r={3} fill={T.violet} />;
        })}
      </svg>
      <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, lineHeight: 1.6 }}>
        {overlayAxes && <><span style={{ color: T.blue }}>▨ A (dashed)</span> vs <span style={{ color: T.violet }}>▨ B</span> · </>}
        bigger shape = better run · <ConceptTrigger id="evaluation">LLM judgment, not ground truth</ConceptTrigger>
      </p>
    </div>
  );
}
