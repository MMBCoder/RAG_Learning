"use client";

import { motion } from "framer-motion";
import { useRagStore, STAGE_IDS, type StageId } from "./ragStore";
import { usePipelineView } from "./timeline/usePipelineView";
import { ConceptTrigger } from "./education/ConceptCard";
import type { ConceptId } from "./education/concepts";
import type { RoiAssumptions } from "./store/historySlice";
import { T, DEPTH, eyebrow } from "./theme";

/* Executive outcome view: the numbers a decision-maker actually asks
   about — measured, never modelled. The ROI card's honesty rule (M8):
   accuracy, latency, and cost are real measurements; projections use
   the user's OWN assumptions, visible and editable on the card, and
   every projected number says "estimate". */

const QUERY_STAGES: StageId[] = ["query", "retrieve", "rerank", "prompt", "generate", "ground", "evaluate"];

function OutcomeTile({ label, value, sub, color, conceptId }: {
  label: string; value: string; sub: string; color?: string; conceptId: ConceptId;
}) {
  return (
    <div style={{
      flex: "1 1 150px", padding: "16px 18px", borderRadius: 13,
      background: T.panel, border: `1px solid ${T.border}`,
      boxShadow: `${T.cardShadow}, ${DEPTH.innerHighlight}`,
    }}>
      <p style={{ ...eyebrow, fontSize: 10.5, marginBottom: 8 }}>
        <ConceptTrigger id={conceptId}>{label}</ConceptTrigger>
      </p>
      <p style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 27, letterSpacing: "-0.03em", color: color ?? T.fg }}>
        {value}
      </p>
      <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginTop: 5 }}>{sub}</p>
    </div>
  );
}

export default function OutcomeStrip() {
  const evalScores = usePipelineView(s => s.evalScores);
  const usage = usePipelineView(s => s.usage);
  const stages = usePipelineView(s => s.stages);
  const ingested = usePipelineView(s => s.ingested);

  const answered = stages.evaluate.status === "done";
  const answerMs = QUERY_STAGES.reduce((n, id) => n + (stages[id].ms ?? 0), 0);
  const anyData = STAGE_IDS.some(id => stages[id].status !== "idle");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ marginBottom: 18 }}
    >
      <p style={{ ...eyebrow, marginBottom: 10, color: T.violet }}>business outcomes — measured live</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <OutcomeTile
          label="groundedness" conceptId="faithfulness"
          value={evalScores ? `${evalScores.faithfulness}/100` : "—"}
          sub={evalScores ? "share of answer backed by the document" : "ask a question to measure"}
          color={evalScores ? (evalScores.faithfulness >= 70 ? T.green : T.amber) : undefined}
        />
        <OutcomeTile
          label="hallucination risk" conceptId="hallucination"
          value={evalScores ? `${evalScores.hallucinationRisk}/100` : "—"}
          sub={evalScores ? "LLM-judge estimate, lower is better" : "ask a question to measure"}
          color={evalScores ? (evalScores.hallucinationRisk <= 30 ? T.green : evalScores.hallucinationRisk <= 55 ? T.amber : T.red) : undefined}
        />
        <OutcomeTile
          label="answer latency" conceptId="latency"
          value={answered && answerMs ? `${(answerMs / 1000).toFixed(1)}s` : "—"}
          sub={answered ? "question → evaluated answer" : "ask a question to measure"}
        />
        <OutcomeTile
          label="session cost" conceptId="cost-economics"
          value={usage.costUSD ? `$${usage.costUSD.toFixed(4)}` : "—"}
          sub={usage.costUSD ? "OpenAI list pricing, this session" : anyData ? "accumulating…" : ingested ? "ready" : "load a document to begin"}
          color={T.green}
        />
      </div>

      <RoiCard />
    </motion.div>
  );
}

/* ── ROI card — real measurements × visible assumptions ────────── */

function AssumptionInput({ label, value, suffix, onChange }: {
  label: string; value: number; suffix: string; onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 130px" }}>
      <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: T.fgMuted }}>
        {label}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={value}
          min={0}
          aria-label={label}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: 84, padding: "6px 9px", borderRadius: 8,
            border: `1px solid ${T.borderStrong}`, background: T.panel,
            fontFamily: T.mono, fontSize: 12.5, color: T.fg,
          }}
        />
        <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted }}>{suffix}</span>
      </span>
    </label>
  );
}

function RoiCard() {
  const usage = usePipelineView(s => s.usage);
  const events = useRagStore(s => s.events);
  const roi = useRagStore(s => s.roiAssumptions);
  const setRoi = useRagStore(s => s.setRoiAssumption);

  // questions really asked this session (from the event log — measured)
  const questions = events.filter(e => e.kind === "run-start" && e.runKind === "query").length;
  const costPerQuestion = questions > 0 ? usage.costUSD / questions : null;

  const monthlyCost = costPerQuestion !== null ? costPerQuestion * roi.questionsPerMonth : null;
  const hoursSaved = (roi.questionsPerMonth * roi.minutesSavedPerQuestion) / 60;
  const valueSaved = hoursSaved * roi.analystHourlyCost;

  const set = (k: keyof RoiAssumptions) => (v: number) => setRoi(k, v);

  return (
    <div style={{
      marginTop: 14, padding: "16px 18px", borderRadius: 13,
      background: T.panel, border: `1px solid ${T.border}`,
      boxShadow: `${T.cardShadow}, ${DEPTH.innerHighlight}`,
    }}>
      <p style={{ ...eyebrow, fontSize: 10.5, marginBottom: 12 }}>
        <ConceptTrigger id="cost-economics">roi projection</ConceptTrigger> — estimate, from your assumptions below
      </p>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: "1 1 150px" }}>
          <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginBottom: 3 }}>measured cost / question</p>
          <p style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 21, color: T.fg }}>
            {costPerQuestion !== null ? `$${costPerQuestion.toFixed(4)}` : "—"}
          </p>
          <p style={{ fontFamily: T.mono, fontSize: 10, color: T.fgMuted }}>
            {questions > 0 ? `${questions} question${questions === 1 ? "" : "s"} this session` : "ask a question to measure"}
          </p>
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginBottom: 3 }}>est. monthly API cost</p>
          <p data-roi-monthly style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 21, color: T.fg }}>
            {monthlyCost !== null ? `$${monthlyCost.toFixed(2)}` : "—"}
          </p>
          <p style={{ fontFamily: T.mono, fontSize: 10, color: T.fgMuted }}>estimate · cost/question × volume</p>
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginBottom: 3 }}>est. monthly analyst value</p>
          <p style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 21, color: T.green }}>
            ${valueSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p style={{ fontFamily: T.mono, fontSize: 10, color: T.fgMuted }}>
            estimate · {hoursSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })} h saved × rate
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
        <AssumptionInput label="questions / month" value={roi.questionsPerMonth} suffix="q" onChange={set("questionsPerMonth")} />
        <AssumptionInput label="minutes saved / question" value={roi.minutesSavedPerQuestion} suffix="min" onChange={set("minutesSavedPerQuestion")} />
        <AssumptionInput label="analyst cost / hour" value={roi.analystHourlyCost} suffix="$/h" onChange={set("analystHourlyCost")} />
      </div>
    </div>
  );
}
