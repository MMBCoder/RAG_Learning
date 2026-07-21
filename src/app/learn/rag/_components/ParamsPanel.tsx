"use client";

import { useEffect } from "react";
import { useRagStore, type RagParams } from "./ragStore";
import { rechunkLocal, reembed, rescoreLocal } from "./lib/pipeline";
import { ConceptTrigger } from "./education/ConceptCard";
import { PARAM_CONCEPT } from "./education/concepts";
import { T, eyebrow } from "./theme";

/* ── controls ─────────────────────────────────────────────── */

function Slider({
  label, paramKey, value, min, max, step, format, onChange, hint,
}: {
  label: string; paramKey: keyof RagParams; value: number; min: number; max: number; step: number;
  format?: (v: number) => string; onChange: (v: number) => void; hint?: string;
}) {
  const pulsing = useRagStore(s => s.paramPulse === paramKey);
  return (
    <div style={{
      marginBottom: 16, borderRadius: 10, padding: pulsing ? "8px 10px" : 0,
      margin: pulsing ? "-8px -10px 8px" : "0 0 16px",
      background: pulsing ? "rgba(124,58,237,0.07)" : "transparent",
      boxShadow: pulsing ? "0 0 0 2px rgba(124,58,237,0.35)" : "none",
      transition: "background 0.4s, box-shadow 0.4s, padding 0.2s, margin 0.2s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.fgSec }}>
          <ConceptTrigger id={PARAM_CONCEPT[paramKey]}>{label}</ConceptTrigger>
        </span>
        <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.blue, fontWeight: 700 }}>{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        aria-label={label}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: T.violet, cursor: "pointer" }}
      />
      {hint && <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function Toggle({ label, paramKey, value, onChange }: {
  label: string; paramKey: keyof RagParams; value: boolean; onChange: (v: boolean) => void;
}) {
  // the concept trigger (a button) lives OUTSIDE the switch so the switch
  // never contains a nested interactive control (axe: nested-interactive)
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "11px 14px", marginBottom: 16,
        background: value ? "rgba(124,58,237,0.06)" : T.inset,
        border: `1px solid ${value ? "rgba(124,58,237,0.45)" : T.border}`, borderRadius: 10,
      }}
    >
      <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.fgSec }}>
        <ConceptTrigger id={PARAM_CONCEPT[paramKey]}>{label}</ConceptTrigger>
      </span>
      <button
        role="switch" aria-checked={value} aria-label={label}
        onClick={() => onChange(!value)}
        style={{
          all: "unset", width: 34, height: 18, borderRadius: 10, position: "relative",
          flexShrink: 0, cursor: "pointer",
          background: value ? T.violet : T.borderStrong, transition: "background 0.2s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: value ? 18 : 2,
          width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(15,23,42,0.3)",
        }} />
      </button>
    </div>
  );
}

/* ── panel ────────────────────────────────────────────────── */

export default function ParamsPanel() {
  const params = useRagStore(s => s.params);
  const setParam = useRagStore(s => s.setParam);
  const ingested = useRagStore(s => s.ingested);
  const chunksStale = useRagStore(s => s.chunksStale);
  const hasDoc = useRagStore(s => s.cleanedPages.length > 0);
  const hasQuery = useRagStore(s => s.queryVec !== null);
  const paramPulse = useRagStore(s => s.paramPulse);
  const pulseParam = useRagStore(s => s.pulseParam);

  // a concept card's "adjust it →" flash fades after a beat
  useEffect(() => {
    if (!paramPulse) return;
    const t = setTimeout(() => pulseParam(null), 2600);
    return () => clearTimeout(t);
  }, [paramPulse, pulseParam]);

  const setChunkParam = <K extends keyof RagParams>(k: K, v: RagParams[K]) => {
    setParam(k, v);
    if (hasDoc) rechunkLocal();
  };
  const setRetrievalParam = <K extends keyof RagParams>(k: K, v: RagParams[K]) => {
    setParam(k, v);
    if (hasQuery) rescoreLocal();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 28 }}>
      <div>
        <p style={{ ...eyebrow, marginBottom: 14, color: T.blue }}>chunking</p>
        <Slider
          label="chunk size" paramKey="chunkSize" value={params.chunkSize} min={200} max={1600} step={50}
          format={v => `${v} chars`} onChange={v => setChunkParam("chunkSize", v)}
          hint="small = precise retrieval · large = more context"
        />
        <Slider
          label="chunk overlap" paramKey="chunkOverlap" value={params.chunkOverlap} min={0} max={300} step={20}
          format={v => `${v} chars`} onChange={v => setChunkParam("chunkOverlap", v)}
          hint="prevents facts being split at boundaries"
        />
        {chunksStale && (
          <button
            onClick={() => reembed()}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, cursor: "pointer",
              background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.5)",
              fontFamily: T.mono, fontSize: 12.5, color: T.amber, fontWeight: 600,
            }}
          >
            ↻ chunks changed — re-embed &amp; re-index
          </button>
        )}
      </div>

      <div>
        <p style={{ ...eyebrow, marginBottom: 14, color: T.cyan }}>retrieval</p>
        <Slider
          label="top-K" paramKey="topK" value={params.topK} min={1} max={8} step={1}
          onChange={v => setRetrievalParam("topK", v)}
          hint="chunks handed to the LLM"
        />
        <Slider
          label="hybrid α (semantic ↔ keyword)" paramKey="hybridAlpha" value={params.hybridAlpha} min={0} max={1} step={0.05}
          format={v => v.toFixed(2)} onChange={v => setRetrievalParam("hybridAlpha", v)}
          hint="1.0 = pure semantic · 0.0 = pure keyword"
        />
        <Slider
          label="similarity threshold" paramKey="threshold" value={params.threshold} min={0} max={0.8} step={0.05}
          format={v => v.toFixed(2)} onChange={v => setRetrievalParam("threshold", v)}
          hint="chunks scoring below are discarded"
        />
        <Toggle label="LLM re-ranking (gemini flash)" paramKey="useRerank" value={params.useRerank} onChange={v => setParam("useRerank", v)} />
      </div>

      <div>
        <p style={{ ...eyebrow, marginBottom: 14, color: T.violet }}>generation</p>
        <Slider
          label="max output tokens" paramKey="maxTokens" value={params.maxTokens} min={128} max={1500} step={64}
          onChange={v => setParam("maxTokens", v)}
        />
        <Slider
          label="context budget" paramKey="contextBudget" value={params.contextBudget} min={500} max={6000} step={250}
          format={v => `${v} tok`} onChange={v => setParam("contextBudget", v)}
          hint="token cap for retrieved chunks in the prompt"
        />
        <Slider
          label="temperature" paramKey="temperature" value={params.temperature} min={0} max={1.4} step={0.1}
          format={v => v.toFixed(1)} onChange={v => setParam("temperature", v)}
          hint="higher = more varied wording; lower = more deterministic"
        />
      </div>

      <div>
        <p style={{ ...eyebrow, marginBottom: 14, color: T.green }}>
          <ConceptTrigger id="system-prompt">system prompt</ConceptTrigger>
        </p>
        <textarea
          value={params.systemPrompt}
          onChange={e => setParam("systemPrompt", e.target.value)}
          aria-label="System prompt"
          rows={7}
          spellCheck={false}
          style={{
            width: "100%", resize: "vertical", padding: "12px 14px", borderRadius: 10,
            background: T.inset, border: `1px solid ${T.border}`,
            fontFamily: T.mono, fontSize: 12.5, color: T.fgSec, lineHeight: 1.65, outline: "none",
          }}
        />
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted, marginTop: 5 }}>
          applies to the next question{ingested ? "" : " · ingest a document first"}
        </p>
      </div>
    </div>
  );
}
