"use client";

import { motion } from "framer-motion";
import { RotateCcw, Compass } from "lucide-react";
import { useRagStore, STAGE_IDS } from "../ragStore";
import { STAGE_BY_ID } from "../stages";
import { ConceptTrigger } from "../education/ConceptCard";
import { coachInsights } from "../coach/insights";
import { T, eyebrow } from "../theme";

/* §C3: the Finale Summary — the lesson recap. Every number on this
   slide comes from the live store; the coach's top-suggestion slots are
   reserved here and go live with M12 (never a placeholder before that).
   The closing hint is the bridge from watching to experimenting. */

export default function SummarySlide({
  onExplore, onReplay,
}: {
  onExplore: () => void;
  onReplay: () => void;
}) {
  const stages = useRagStore(s => s.stages);
  const evalScores = useRagStore(s => s.evalScores);
  const usage = useRagStore(s => s.usage);
  const sentences = useRagStore(s => s.answerSentences);
  const candidates = useRagStore(s => s.candidates);
  const results = useRagStore(s => s.results);
  const params = useRagStore(s => s.params);
  const promptBlocks = useRagStore(s => s.promptBlocks);
  const chunks = useRagStore(s => s.chunks);
  // the coach slots reserved in M5 go live in M12
  const coach = coachInsights({ stages, candidates, results, params, promptBlocks, evalScores, answerSentences: sentences, chunks }).slice(0, 3);

  const timed = STAGE_IDS
    .map(id => ({ id, ms: stages[id].ms ?? 0 }))
    .filter(x => x.ms > 0);
  const totalMs = timed.reduce((n, x) => n + x.ms, 0);
  const slowest = [...timed].sort((a, b) => b.ms - a.ms).slice(0, 4);
  const cited = sentences.filter(s => s.citations.length > 0).length;

  const evalBars = evalScores ? [
    { label: "faithfulness", v: evalScores.faithfulness, color: T.green },
    { label: "answer relevance", v: evalScores.answerRelevance, color: T.blue },
    { label: "context precision", v: evalScores.contextPrecision, color: T.violet },
    { label: "hallucination risk", v: evalScores.hallucinationRisk, color: T.amber },
  ] : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      data-testid="finale-summary"
    >
      <p style={{ ...eyebrow, color: T.violet, marginBottom: 10 }}>the run, in numbers — recap</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 14 }}>
        {/* timings ribbon */}
        <div>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6 }}>
            <ConceptTrigger id="latency">where the time went</ConceptTrigger> · {(totalMs / 1000).toFixed(1)}s total
          </p>
          {slowest.map(x => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.fgSec, width: 92, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {STAGE_BY_ID[x.id].title.toLowerCase()}
              </span>
              <div style={{ flex: 1, height: 6, background: "rgba(15,23,42,0.07)", borderRadius: 3 }}>
                <div style={{ width: `${(x.ms / (slowest[0].ms || 1)) * 100}%`, height: "100%", background: T.blue, borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.fg, fontWeight: 600 }}>
                {x.ms >= 1000 ? `${(x.ms / 1000).toFixed(1)}s` : `${x.ms}ms`}
              </span>
            </div>
          ))}
        </div>

        {/* eval bars */}
        <div>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6 }}>
            <ConceptTrigger id="evaluation">the judge&apos;s scores</ConceptTrigger>
          </p>
          {evalBars.length > 0 ? evalBars.map(b => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.fgSec, width: 118 }}>{b.label}</span>
              <div style={{ flex: 1, height: 6, background: "rgba(15,23,42,0.07)", borderRadius: 3 }}>
                <div style={{ width: `${b.v}%`, height: "100%", background: b.color, borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.fg, fontWeight: 600 }}>{b.v}</span>
            </div>
          )) : (
            <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgMuted }}>evaluation unavailable this run</p>
          )}
        </div>
      </div>

      <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgSec, marginBottom: 14 }}>
        {cited}/{sentences.length} sentences cited · session cost ${usage.costUSD.toFixed(4)} ·{" "}
        {usage.promptTokens.toLocaleString()} tokens in / {usage.completionTokens.toLocaleString()} out
      </p>

      {coach.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6, color: T.amber }}>the coach&apos;s top suggestions for this run</p>
          {coach.map(c => (
            <p key={c.id} style={{ fontSize: 12.5, lineHeight: 1.6, color: T.fg, marginBottom: 5, paddingLeft: 10, borderLeft: `3px solid ${T.amber}` }}>
              {c.text}
            </p>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: T.fgSec, marginBottom: 14 }}>
          Now break something on purpose: lower <ConceptTrigger id="top-k">top-K</ConceptTrigger> to 1, ask the
          same question again, and watch these numbers move.
        </p>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={onExplore}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
            borderRadius: 10, cursor: "pointer", background: T.grad, border: "none",
            fontFamily: T.disp, fontWeight: 700, fontSize: 13.5, color: "#fff",
          }}
        >
          <Compass size={14} /> explore freely
        </button>
        <button
          onClick={onReplay}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
            borderRadius: 10, cursor: "pointer", background: T.inset,
            border: `1px solid ${T.borderStrong}`,
            fontFamily: T.disp, fontWeight: 700, fontSize: 13.5, color: T.fg,
          }}
        >
          <RotateCcw size={14} /> run it again
        </button>
      </div>
    </motion.div>
  );
}
