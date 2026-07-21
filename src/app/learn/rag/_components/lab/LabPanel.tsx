"use client";

import { useState } from "react";
import { FlaskConical, Play } from "lucide-react";
import { useRagStore, type RagParams } from "../ragStore";
import { runQuery, rechunkLocal, reembed } from "../lib/pipeline";
import { LAB_EXPERIMENTS, type LabExperiment } from "./experiments";
import { embedReuse } from "../playground/compareUtils";
import { CONCEPTS } from "../education/concepts";
import { ConceptTrigger } from "../education/ConceptCard";
import { T, eyebrow } from "../theme";

/* AI Lab (F12): sabotage with a hypothesis. The flow is prediction →
   run → measured verdict: the current run is auto-pinned as the
   baseline, the preset applies its dials (with an honest re-embed cost
   preview when chunking changes), and the SAME question re-runs. The
   A/B playground shows the verdict — one comparison engine, two doors. */

export default function LabPanel() {
  const params = useRagStore(s => s.params);
  const chunks = useRagStore(s => s.chunks);
  const answer = useRagStore(s => s.answer);
  const query = useRagStore(s => s.query);
  const labActive = useRagStore(s => s.labActive);
  const [selected, setSelected] = useState<LabExperiment | null>(null);

  const ready = !!answer && !!query;

  const run = async (exp: LabExperiment) => {
    const s = useRagStore.getState();
    if (!s.answer) return;
    const question = s.query;                          // same question, sabotaged config
    s.pinA();                                          // baseline = what you predicted against
    s.setLabActive({ id: exp.id, hypothesis: exp.hypothesis });
    s.setDockTab("playground");                        // the verdict lives in the A/B view
    for (const [k, v] of Object.entries(exp.apply)) {
      s.setParam(k as keyof RagParams, v as RagParams[keyof RagParams]);
    }
    if (exp.needsReembed) {
      rechunkLocal();
      const ok = await reembed();
      if (!ok) return;
    }
    const ok = await runQuery(question);
    if (ok) useRagStore.getState().markLabRun();       // journey ch. 6
  };

  return (
    <div>
      <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgSec, lineHeight: 1.7, marginBottom: 14 }}>
        break the pipeline on purpose. each experiment states its <em>hypothesis first</em> —
        run it, then check the prediction against the measured A/B verdict.
        {!ready && <span style={{ color: T.amber }}> ask a question first, so there&apos;s a baseline to break.</span>}
      </p>

      {labActive && (
        <p style={{
          marginBottom: 12, padding: "9px 12px", borderRadius: 10, fontFamily: T.mono, fontSize: 11.5,
          background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.45)", color: T.violet,
        }}>
          experiment running: {labActive.id} — verdict lands in the playground tab
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
        {LAB_EXPERIMENTS.map(exp => {
          const isSel = selected?.id === exp.id;
          return (
            <button
              key={exp.id}
              data-lab-preset={exp.id}
              onClick={() => setSelected(isSel ? null : exp)}
              aria-expanded={isSel}
              style={{
                textAlign: "left", padding: "11px 13px", borderRadius: 11, cursor: "pointer",
                background: isSel ? "rgba(124,58,237,0.06)" : T.inset,
                border: `1px solid ${isSel ? "rgba(124,58,237,0.5)" : T.border}`,
              }}
            >
              <p style={{ fontFamily: T.disp, fontWeight: 700, fontSize: 13, color: T.fg, display: "flex", alignItems: "center", gap: 6 }}>
                <FlaskConical size={13} color={T.violet} /> {exp.label}
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{ marginTop: 12, padding: "13px 15px", borderRadius: 12, background: T.panel, border: `1px solid ${T.borderStrong}` }}>
          <p style={{ ...eyebrow, fontSize: 10, marginBottom: 6 }}>hypothesis — predict before you run</p>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: T.fg, marginBottom: 8 }}>{selected.hypothesis}</p>
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted, marginBottom: 10 }}>
            concept: <ConceptTrigger id={selected.conceptId}>{CONCEPTS[selected.conceptId].term}</ConceptTrigger>
            {" · "}applies: {Object.entries(selected.apply).map(([k, v]) => `${k}=${v}`).join(", ")}
          </p>
          {selected.needsReembed && (
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, marginBottom: 10 }}>
              re-chunks the document → re-embed est. ${embedReuse(params, { ...params, ...selected.apply }, chunks).estCostUSD.toFixed(4)}
            </p>
          )}
          <button
            onClick={() => void run(selected)}
            disabled={!ready}
            data-lab-run
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 17px",
              borderRadius: 10, cursor: ready ? "pointer" : "default",
              background: ready ? T.grad : T.inset, border: ready ? "none" : `1px solid ${T.border}`,
              fontFamily: T.disp, fontWeight: 700, fontSize: 13, color: ready ? "#fff" : T.fgMuted,
            }}
          >
            <Play size={13} /> run the experiment
          </button>
        </div>
      )}
    </div>
  );
}
