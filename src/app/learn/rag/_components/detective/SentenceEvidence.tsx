"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRagStore, PRICING } from "../ragStore";
import { cosine } from "../lib/retrieval";
import { T } from "../theme";

/* Evidence hunt for UNSUPPORTED sentences (M9): embed the sentence
   itself (one explicit, user-triggered API call) and show the nearest
   real passages — then say honestly which failure mode the numbers
   point at: threshold, top-K, or the model overclaiming. */

interface Nearest { id: number; sim: number; rank: number; preview: string; }

export default function SentenceEvidence({ sentence }: { sentence: string }) {
  const [nearest, setNearest] = useState<Nearest[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    const s = useRagStore.getState();
    if (s.embeddings.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rag/embed", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: [sentence] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "embed failed");
      const vec = json.vectors[0] as number[];
      s.addUsage({ embedTokens: json.tokens, costUSD: (json.tokens * PRICING.embedInput) / 1e6 });

      const rankById = new Map(s.candidates.map(c => [c.chunkId, c.rank]));
      const scored = s.chunks.map((c, i) => ({
        id: c.id,
        sim: cosine(vec, s.embeddings[i]),
        rank: rankById.get(c.id) ?? 0,
        preview: c.text.slice(0, 130),
      })).sort((a, b) => b.sim - a.sim).slice(0, 3);
      setNearest(scored);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  };

  const s = useRagStore.getState();
  const diagnosis = (top: Nearest): string => {
    if (top.sim < s.params.threshold) {
      return `The closest passage scores ${(top.sim * 100).toFixed(0)}% — below your ${(s.params.threshold * 100).toFixed(0)}% threshold. Either the bar is too high, or the document simply doesn't state this.`;
    }
    if (top.rank > s.params.topK) {
      return `This passage ranked #${top.rank} for the ORIGINAL question — outside your top-${s.params.topK}. A higher top-K might have delivered it.`;
    }
    return `Nearby evidence existed and was retrievable — which points at the remaining suspect: the model overclaimed beyond what the passage says.`;
  };

  return (
    <div>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: T.fgSec, marginBottom: 10 }}>
        The judge found no supporting passage for this sentence. Hunt for the nearest evidence
        in the document — maybe retrieval missed it, maybe it isn&apos;t there.
      </p>
      {!nearest && (
        <button
          onClick={() => void find()}
          disabled={busy}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 16px",
            borderRadius: 10, cursor: busy ? "wait" : "pointer",
            background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.45)",
            fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.violet,
          }}
        >
          <Search size={13} /> {busy ? "embedding the sentence…" : "find nearest evidence (1 embedding call)"}
        </button>
      )}
      {error && <p style={{ fontFamily: T.mono, fontSize: 11.5, color: T.red, marginTop: 8 }}>{error}</p>}
      {nearest && (
        <div>
          {nearest.map(n => (
            <div key={n.id} data-nearest-evidence={n.id} style={{
              padding: "9px 12px", borderRadius: 9, marginBottom: 6,
              background: T.inset, border: `1px solid ${T.border}`,
              fontFamily: T.mono, fontSize: 11.5, color: T.fgSec, lineHeight: 1.55,
            }}>
              <span style={{ color: T.blue, fontWeight: 700 }}>chunk {n.id}</span>
              {" · "}sim {(n.sim * 100).toFixed(0)}% · original rank #{n.rank || "—"}
              <br />{n.preview}…
            </div>
          ))}
          <p style={{ fontSize: 12.5, lineHeight: 1.65, color: T.fg, marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.4)" }}>
            {diagnosis(nearest[0])}
          </p>
        </div>
      )}
    </div>
  );
}
