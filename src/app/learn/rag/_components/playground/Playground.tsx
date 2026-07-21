"use client";

import { useEffect, useMemo } from "react";
import { Pin, PinOff, Play } from "lucide-react";
import { useRagStore, STAGE_IDS, type StageId } from "../ragStore";
import { runQuery } from "../lib/pipeline";
import { changedParams, embedReuse, buildDiffFacts } from "./compareUtils";
import { explainDiff } from "../lab/ExplanationEngine";
import EvalRadar from "../radar/EvalRadar";
import { ConceptTrigger } from "../education/ConceptCard";
import { usePersona } from "../education/usePersona";
import { T, eyebrow } from "../theme";

/* A/B Playground (F11): pin the current run as A, change anything, run
   B with the SAME question, and let measurements settle the argument.
   Embed-reuse detection keeps the cost honest: unchanged chunking means
   $0 extra on embeddings, and says so before you run. */

const QUERY_STAGES: StageId[] = ["query", "retrieve", "rerank", "prompt", "generate", "ground", "evaluate"];

export default function Playground() {
  const pinnedA = useRagStore(s => s.pinnedA);
  const pinA = useRagStore(s => s.pinA);
  const clearPin = useRagStore(s => s.clearPin);
  const markCompared = useRagStore(s => s.markCompared);
  const comparedRuns = useRagStore(s => s.comparedRuns);
  const answer = useRagStore(s => s.answer);
  const params = useRagStore(s => s.params);
  const chunks = useRagStore(s => s.chunks);
  const results = useRagStore(s => s.results);
  const evalScores = useRagStore(s => s.evalScores);
  const usage = useRagStore(s => s.usage);
  const stages = useRagStore(s => s.stages);
  const runId = useRagStore(s => s.runId);
  const { showRawData } = usePersona();

  const busy = STAGE_IDS.some(id => stages[id].status === "running");
  const queryMs = QUERY_STAGES.reduce((n, id) => n + (stages[id].ms ?? 0), 0);

  const diff = pinnedA ? changedParams(pinnedA.params, params) : [];
  const reuse = pinnedA ? embedReuse(pinnedA.params, params, chunks) : null;

  // B is complete when a NEWER run answered the SAME question
  const bReady = !!(pinnedA && evalScores && runId > pinnedA.runId && !busy);
  const facts = useMemo(
    () => (pinnedA && bReady
      ? buildDiffFacts(pinnedA, { params, results, evalScores, queryMs, costUSD: usage.costUSD })
      : null),
    [pinnedA, bReady, params, results, evalScores, queryMs, usage.costUSD],
  );

  // journey ch. 7: a comparison was really seen (once per pin)
  useEffect(() => {
    if (facts && comparedRuns === 0) markCompared();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts === null]);

  if (!answer && !pinnedA) {
    return (
      <p style={{ fontFamily: T.mono, fontSize: 12.5, color: T.fgMuted, lineHeight: 1.7 }}>
        run a question first — then pin the result as configuration A and change anything you like.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {!pinnedA ? (
          <button onClick={pinA} disabled={!answer} style={btn(T.blue)}>
            <Pin size={13} /> pin this run as A
          </button>
        ) : (
          <>
            <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.blue, fontWeight: 700 }}>
              A pinned · “{pinnedA.query.slice(0, 40)}{pinnedA.query.length > 40 ? "…" : ""}”
            </span>
            <button
              onClick={() => void runQuery(pinnedA.query)}
              disabled={busy}
              style={btn(T.violet)}
              data-run-b
            >
              <Play size={13} /> run B with current params
            </button>
            <button onClick={clearPin} style={btn(T.fgMuted)} aria-label="Unpin A">
              <PinOff size={13} /> unpin
            </button>
          </>
        )}
      </div>

      {pinnedA && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6 }}>changed vs A</p>
          {diff.length === 0 ? (
            <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgMuted }}>nothing yet — move any dial in the parameters tab</p>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {diff.map(k => (
                <span key={k} data-param-diff={k} style={{
                  padding: "4px 11px", borderRadius: 9,
                  background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.45)",
                  fontFamily: T.mono, fontSize: 11, color: T.violet, fontWeight: 600,
                }}>
                  {k}
                </span>
              ))}
            </div>
          )}
          {reuse && (
            <p data-embed-reuse style={{ fontFamily: T.mono, fontSize: 11, marginTop: 8, color: reuse.reuse ? T.green : T.amber }}>
              {reuse.reuse
                ? "same chunking — B re-uses A's embeddings: $0.0000 extra embedding cost"
                : `chunking changed — B must re-embed ${chunks.length} chunks: est. $${reuse.estCostUSD.toFixed(4)} (${reuse.estTokens.toLocaleString()} tokens)`}
            </p>
          )}
        </div>
      )}

      {facts && pinnedA && (
        <div data-diff-view>
          <p style={{ ...eyebrow, marginBottom: 10 }}>
            <ConceptTrigger id="evaluation">a/b verdict</ConceptTrigger> — measured, not vibes
          </p>

          {evalScores && <EvalRadar scores={evalScores} overlay={pinnedA.evalScores} size={230} />}

          <div style={{ margin: "12px 0" }}>
            {explainDiff(facts).map((line, i) => (
              <p key={i} style={{ fontSize: 13, lineHeight: 1.65, color: T.fg, marginBottom: 6, paddingLeft: 10, borderLeft: `3px solid ${T.violet}` }}>
                {line}
              </p>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <AnswerCard label="A" text={pinnedA.answer ?? ""} color={T.blue} />
            <AnswerCard label="B" text={answer ?? ""} color={T.violet} />
          </div>

          {showRawData && (
            <pre style={{
              marginTop: 10, padding: "10px 12px", background: T.inset, borderRadius: 10,
              border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 10.5,
              color: T.fgSec, whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto",
            }}>
              {JSON.stringify(facts, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function AnswerCard({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: T.inset, border: `1px solid ${color}55` }}>
      <p style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 700, color, marginBottom: 5 }}>answer {label}</p>
      <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgSec, lineHeight: 1.6, maxHeight: 140, overflowY: "auto" }}>{text}</p>
    </div>
  );
}

const btn = (color: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 7, padding: "8px 15px",
  borderRadius: 10, cursor: "pointer",
  background: T.panel, border: `1px solid ${color}66`,
  fontFamily: T.mono, fontSize: 12, fontWeight: 600, color,
});
