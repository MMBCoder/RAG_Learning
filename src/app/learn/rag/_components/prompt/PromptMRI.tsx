"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useRagStore } from "../ragStore";
import { usePipelineView } from "../timeline/usePipelineView";
import { ConceptTrigger } from "../education/ConceptCard";
import { T } from "../theme";

/* Prompt MRI (F8): the assembled prompt sliced open — a token donut for
   proportions, expandable blocks for the actual text, and per-chunk
   sub-blocks with trace-hover into the sources panel. Everything shown
   is the REAL package the model received. */

function TokenDonut({ parts, total }: { parts: { label: string; tokens: number; color: string }[]; total: number }) {
  const R = 34, C = 2 * Math.PI * R;
  // precompute cumulative offsets (render must not mutate)
  const segments = parts.reduce<{ label: string; color: string; frac: number; offset: number }[]>((acc, p) => {
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].frac : 0;
    acc.push({ label: p.label, color: p.color, frac: total ? p.tokens / total : 0, offset });
    return acc;
  }, []);
  return (
    <svg width={92} height={92} viewBox="0 0 92 92" role="img" aria-label={`Prompt token composition, ${total} tokens total`}>
      <circle cx={46} cy={46} r={R} fill="none" stroke="rgba(15,23,42,0.07)" strokeWidth={13} />
      {segments.map(p => (
        <circle
          key={p.label}
          cx={46} cy={46} r={R} fill="none"
          stroke={p.color} strokeWidth={13}
          strokeDasharray={`${p.frac * C} ${C}`}
          strokeDashoffset={-p.offset * C}
          transform="rotate(-90 46 46)"
        />
      ))}
      <text x={46} y={43} textAnchor="middle" style={{ font: `700 14px ${T.mono}`, fill: T.fg }}>{total}</text>
      <text x={46} y={57} textAnchor="middle" style={{ font: `600 8.5px ${T.mono}`, fill: T.fgMuted, letterSpacing: "0.08em" }}>TOKENS</text>
    </svg>
  );
}

export default function PromptMRI() {
  const blocks = usePipelineView(s => s.promptBlocks);
  const results = usePipelineView(s => s.results);
  const chunks = usePipelineView(s => s.chunks);
  const hoverChunk = useRagStore(s => s.hoverChunk);
  const setHoverChunk = useRagStore(s => s.setHoverChunk);
  const [open, setOpen] = useState<string | null>(null);

  if (blocks.length === 0) return null;
  const total = blocks.reduce((n, b) => n + b.tokens, 0);
  const byId = new Map(chunks.map(c => [c.id, c]));

  return (
    <div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <TokenDonut parts={blocks} total={total} />
        <div style={{ flex: "1 1 180px" }}>
          {blocks.map(b => (
            <p key={b.label} style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgSec, marginBottom: 4 }}>
              <span style={{ color: b.color }}>■</span> {b.label.toLowerCase()} · {b.tokens}t
              {total ? ` · ${Math.round((b.tokens / total) * 100)}%` : ""}
            </p>
          ))}
          <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginTop: 6 }}>
            the model receives exactly this — <ConceptTrigger id="prompt-construction">one assembled package</ConceptTrigger>
          </p>
        </div>
      </div>

      {blocks.map(b => {
        const expanded = open === b.label;
        return (
          <div key={b.label} style={{ marginBottom: 8 }}>
            <button
              onClick={() => setOpen(expanded ? null : b.label)}
              aria-expanded={expanded}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                background: `${b.color}0D`, border: `1px solid ${b.color}55`,
                fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.fg,
              }}
            >
              <ChevronDown size={13} style={{ transform: expanded ? "none" : "rotate(-90deg)", transition: "transform 0.15s", color: b.color }} />
              {b.label.toLowerCase()} · {b.tokens} tokens
            </button>
            {expanded && b.label !== "Retrieved Context" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={snippet}>
                {b.text.length > 900 ? `${b.text.slice(0, 900)}…` : b.text}
              </motion.div>
            )}
            {expanded && b.label === "Retrieved Context" && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                {results.map(id => {
                  const c = byId.get(id);
                  if (!c) return null;
                  const hot = hoverChunk === id;
                  return (
                    <div
                      key={id}
                      onMouseEnter={() => setHoverChunk(id)}
                      onMouseLeave={() => setHoverChunk(null)}
                      style={{
                        padding: "8px 11px", borderRadius: 9,
                        background: hot ? "#EFF4FE" : T.inset,
                        border: `1px solid ${hot ? "rgba(37,99,235,0.5)" : T.border}`,
                        fontFamily: T.mono, fontSize: 11.5, color: T.fgSec, lineHeight: 1.55,
                      }}
                    >
                      <span style={{ color: T.blue, fontWeight: 700 }}>[{id}]</span> p.{c.page} · {c.tokens}t — {c.text.slice(0, 80)}…
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const snippet: React.CSSProperties = {
  marginTop: 6, padding: "11px 13px", background: T.inset, borderRadius: 10,
  border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 12,
  color: T.fgSec, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
};
