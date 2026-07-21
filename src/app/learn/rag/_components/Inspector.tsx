"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useRagStore, type StageId, PRICING } from "./ragStore";
import { STAGE_BY_ID } from "./stages";
import { pseudoTokens } from "./lib/text";
import { renderPdfPage } from "./lib/pdf";
import { RERANK_POOL_EXTRA } from "./lib/pipeline";
import { stageArtifact } from "./store/artifacts";
import { usePipelineView } from "./timeline/usePipelineView";
import { useWindowed } from "./lib/useWindowed";
import PromptMRI from "./prompt/PromptMRI";
import ContextContainer from "./prompt/ContextContainer";
import EvalRadar from "./radar/EvalRadar";
import { ConceptBlock } from "./education/ConceptCard";
import { STAGE_CONCEPT } from "./education/concepts";
import { usePersona } from "./education/usePersona";
import { T, eyebrow } from "./theme";
import Universe from "./universe/Universe";

/* ── shared primitives ────────────────────────────────────── */

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ ...eyebrow, marginBottom: 9 }}>{title}</p>
      {children}
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14.5, color: T.fgSec, lineHeight: 1.65 }}>{children}</p>;
}

function KV({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.fgMuted }}>{k}</span>
      <span style={{ fontFamily: T.mono, fontSize: 12, color: color ?? T.fg, textAlign: "right", fontWeight: 600 }}>{v}</span>
    </div>
  );
}

function Bar({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = Math.min(100, (value / (max || 1)) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.fgSec }}>{label}</span>
        <span style={{ fontFamily: T.mono, fontSize: 12, color, fontWeight: 600 }}>{suffix ?? value.toFixed(2)}</span>
      </div>
      <div style={{ height: 6, background: "rgba(15,23,42,0.08)", borderRadius: 3, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ height: "100%", background: color, borderRadius: 3 }}
        />
      </div>
    </div>
  );
}

function Snippet({ text, color }: { text: string; color?: string }) {
  return (
    <div
      tabIndex={0}
      style={{
        padding: "12px 14px", background: T.inset, borderRadius: 10,
        border: `1px solid ${color ?? T.border}`, fontFamily: T.mono,
        fontSize: 12.5, color: T.fgSec, lineHeight: 1.65, whiteSpace: "pre-wrap",
        maxHeight: 170, overflowY: "auto",
      }}
    >
      {text}
    </div>
  );
}

/* ── PDF page preview ─────────────────────────────────────── */

function PdfPreview({ page }: { page: number }) {
  const pdfData = useRagStore(s => s.pdfData);
  const isPdf = useRagStore(s => s.docKind === "pdf");
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (pdfData && isPdf && ref.current) {
      renderPdfPage(pdfData, page, ref.current, 350).catch(() => {});
    }
  }, [pdfData, isPdf, page]);
  if (!pdfData || !isPdf) return null;
  return (
    <canvas ref={ref} style={{
      width: "100%", borderRadius: 10, border: `1px solid ${T.border}`, background: "#fff",
    }} />
  );
}

/* ── per-stage views ──────────────────────────────────────── */

function UploadView() {
  const s = usePipelineView(v => v);
  if (!s.docName) return <Body>No document loaded yet. Upload a file — PDF, Word, Excel, Markdown, or image (≤ 10 MB) — or load the sample product guide.</Body>;
  return (
    <>
      <Sec title="Document">
        <KV k="file" v={s.docName} />
        <KV k="size" v={`${(s.docBytes / 1024).toFixed(1)} KB`} />
        <KV k="source" v={s.isSample ? "built-in sample" : "user upload"} />
        {s.pages.length > 0 && <KV k="pages" v={String(s.pages.length)} />}
      </Sec>
      {s.pdfData && s.docKind === "pdf" && <Sec title="Preview — page 1"><PdfPreview page={1} /></Sec>}
    </>
  );
}

function ParseView() {
  const pages = usePipelineView(s => s.pages);
  if (pages.length === 0) return <Body>Nothing parsed yet.</Body>;
  const max = Math.max(...pages.map(p => p.text.length));
  return (
    <>
      <Sec title={`Extraction — ${pages.length} pages`}>
        {pages.slice(0, 10).map(p => (
          <Bar key={p.page} label={`page ${p.page}`} value={p.text.length} max={max} color={T.blue} suffix={`${p.text.length.toLocaleString()} ch`} />
        ))}
        {pages.length > 10 && <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgMuted }}>+ {pages.length - 10} more pages</p>}
      </Sec>
      <Sec title="Raw text — page 1"><Snippet text={pages[0].text.slice(0, 420) + "…"} /></Sec>
    </>
  );
}

function CleanView() {
  const stats = usePipelineView(s => s.cleanStats);
  const raw = usePipelineView(s => s.pages[0]?.text ?? "");
  const cleaned = usePipelineView(s => s.cleanedPages[0]?.text ?? "");
  if (!stats) return <Body>Not cleaned yet.</Body>;
  return (
    <>
      <Sec title="Normalisation report">
        <KV k="chars before" v={stats.before.toLocaleString()} />
        <KV k="chars after" v={stats.after.toLocaleString()} color={T.green} />
        <KV k="line breaks joined" v={String(stats.joinedLines)} />
        <KV k="hyphenations fixed" v={String(stats.fixedHyphens)} />
      </Sec>
      <Sec title="Before"><Snippet text={raw.slice(0, 220) + "…"} color="rgba(220,38,38,0.3)" /></Sec>
      <Sec title="After"><Snippet text={cleaned.slice(0, 220) + "…"} color="rgba(5,150,105,0.35)" /></Sec>
    </>
  );
}

function ChunkView() {
  const chunks = usePipelineView(s => s.chunks);
  const params = useRagStore(s => s.params);
  const hoverChunk = useRagStore(s => s.hoverChunk);
  const setHoverChunk = useRagStore(s => s.setHoverChunk);
  const openChunkProfile = useRagStore(s => s.openChunkProfile);
  const [open, setOpen] = useState<number | null>(null);
  const win = useWindowed(chunks, 80, 340);   // stays smooth at 1,000 chunks (M6)
  if (chunks.length === 0) return <Body>No chunks yet.</Body>;
  return (
    <>
      <Sec title="Strategy">
        <KV k="target size" v={`${params.chunkSize} chars`} />
        <KV k="overlap" v={`${params.chunkOverlap} chars`} />
        <KV k="boundary" v="sentence-aware" />
        <KV k="chunks" v={String(chunks.length)} color={T.blue} />
      </Sec>
      <Sec title="Chunks — click to expand">
        <div
          onScroll={win.onScroll}
          tabIndex={0} aria-label="Chunk list"
          style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 340, overflowY: "auto", paddingRight: 4 }}
        >
          {win.padTop > 0 && <div style={{ height: win.padTop, flexShrink: 0 }} aria-hidden />}
          {win.slice.map(c => {
            const expanded = open === c.id;
            const hot = hoverChunk === c.id;
            return (
              <motion.div
                key={c.id} layout={!win.windowed}
                onClick={() => setOpen(expanded ? null : c.id)}
                onMouseEnter={() => setHoverChunk(c.id)}
                onMouseLeave={() => setHoverChunk(null)}
                style={{
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  background: hot ? "#EFF4FE" : T.inset,
                  border: `1px solid ${hot ? "rgba(37,99,235,0.5)" : T.border}`,
                }}
              >
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.blue, fontWeight: 700 }}>#{c.id}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgMuted }}>p.{c.page} · {c.chars} ch · {c.tokens} tok</span>
                  {c.overlapChars > 0 && (
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: "#92400E", background: "rgba(217,119,6,0.1)", padding: "1px 7px", borderRadius: 6 }}>
                      ↩ {c.overlapChars} overlap
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: T.mono, fontSize: 12, color: T.fgSec, lineHeight: 1.6, marginTop: 6 }}>
                  {expanded ? c.text : c.text.slice(0, 90) + (c.text.length > 90 ? "…" : "")}
                </p>
                {expanded && (
                  <button
                    onClick={e => { e.stopPropagation(); openChunkProfile(c.id); }}
                    style={{
                      marginTop: 8, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                      background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.4)",
                      fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.blue,
                    }}
                  >
                    life story →
                  </button>
                )}
              </motion.div>
            );
          })}
          {win.padBottom > 0 && <div style={{ height: win.padBottom, flexShrink: 0 }} aria-hidden />}
        </div>
      </Sec>
    </>
  );
}

function TokenizeView() {
  const chunks = usePipelineView(s => s.chunks);
  const [idx, setIdx] = useState(0);
  if (chunks.length === 0) return <Body>No chunks to tokenize yet.</Body>;
  const chunk = chunks[Math.min(idx, chunks.length - 1)];
  const tokens = pseudoTokens(chunk.text).slice(0, 90);
  const palette = [T.blue, T.violet, T.cyan, T.green, T.amber];
  return (
    <>
      <Sec title="Token stream">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} style={navBtn} aria-label="Previous chunk"><ChevronLeft size={15} /></button>
          <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.fgSec }}>chunk {chunk.id} / {chunks.length} · ≈{chunk.tokens} tokens</span>
          <button onClick={() => setIdx(i => Math.min(chunks.length - 1, i + 1))} style={navBtn} aria-label="Next chunk"><ChevronRight size={15} /></button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 260, overflowY: "auto" }}>
          {tokens.map((t, i) => (
            <motion.span
              key={`${chunk.id}-${i}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.014, duration: 0.18 }}
              style={{
                fontFamily: T.mono, fontSize: 12.5, padding: "3px 8px", borderRadius: 6,
                color: palette[i % palette.length], fontWeight: 600,
                background: T.inset,
                border: `1px solid ${T.border}`,
              }}
            >
              {t}
            </motion.span>
          ))}
        </div>
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted, marginTop: 12 }}>
          display tokenization is illustrative · counts estimated with a cl100k-style heuristic
        </p>
      </Sec>
    </>
  );
}

const navBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 8, cursor: "pointer",
  background: T.inset, border: `1px solid ${T.border}`, color: T.fgSec,
};

function EmbedView() {
  const embeddings = usePipelineView(s => s.embeddings);
  const usage = usePipelineView(s => s.usage);
  return (
    <>
      <Sec title="Embedding universe — PCA projection of real vectors">
        <Universe height={260} />
      </Sec>
      {embeddings.length > 0 && (
        <>
          <Sec title="Vector sample — chunk 1, first 14 of 768 dims">
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 56 }}>
              {embeddings[0].slice(0, 14).map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.min(100, Math.abs(v) * 900)}%` }}
                  style={{
                    flex: 1, borderRadius: 2, minHeight: 3,
                    background: v >= 0 ? T.blue : T.violet,
                    alignSelf: v >= 0 ? "flex-end" : "flex-start",
                  }}
                  title={v.toFixed(4)}
                />
              ))}
            </div>
          </Sec>
          <Sec title="Call stats">
            <KV k="model" v="gemini-embedding-001" />
            <KV k="dimensions" v="768" />
            <KV k="embed tokens (session)" v={usage.embedTokens.toLocaleString()} />
            <KV k="est. embed cost" v={`$${((usage.embedTokens * PRICING.embedInput) / 1e6).toFixed(6)}`} color={T.green} />
          </Sec>
        </>
      )}
    </>
  );
}

function IndexView() {
  const chunks = usePipelineView(s => s.chunks);
  const embeddings = usePipelineView(s => s.embeddings);
  const ingested = usePipelineView(s => s.ingested);
  const idxWin = useWindowed(chunks, 35, 300);   // stays smooth at 1,000 rows (M6)
  if (embeddings.length === 0) return <Body>Nothing indexed yet.</Body>;
  return (
    <>
      <Sec title="Index">
        <KV k="engine" v="in-memory (Chroma-style)" />
        <KV k="metric" v="cosine similarity" />
        <KV k="entries" v={String(embeddings.length)} color={ingested ? T.green : T.amber} />
      </Sec>
      <Sec title="Insertions — vector + metadata">
        <div onScroll={idxWin.onScroll} style={{ maxHeight: 300, overflowY: "auto" }}>
          {idxWin.padTop > 0 && <div style={{ height: idxWin.padTop }} aria-hidden />}
          {idxWin.slice.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idxWin.windowed ? 0 : Math.min(i * 0.05, 1.2) }}
              style={{
                display: "flex", justifyContent: "space-between", gap: 8,
                padding: "8px 10px", borderBottom: `1px solid ${T.border}`,
                fontFamily: T.mono, fontSize: 12,
              }}
            >
              <span style={{ color: T.blue, fontWeight: 600 }}>vec_{String(c.id).padStart(3, "0")}</span>
              <span style={{ color: T.fgMuted }}>{`{page:${c.page}, tokens:${c.tokens}, chars:${c.chars}}`}</span>
            </motion.div>
          ))}
          {idxWin.padBottom > 0 && <div style={{ height: idxWin.padBottom }} aria-hidden />}
        </div>
      </Sec>
    </>
  );
}

function QueryView() {
  const query = usePipelineView(s => s.query);
  const queryVec = usePipelineView(s => s.queryVec);
  if (!query) return <Body>Ask a question below the pipeline to see it embedded into the same vector space as the document.</Body>;
  return (
    <>
      <Sec title="Question"><Snippet text={query} color="rgba(37,99,235,0.35)" /></Sec>
      {queryVec && (
        <Sec title="Query vector — first 14 of 768 dims">
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 56 }}>
            {queryVec.slice(0, 14).map((v, i) => (
              <motion.div
                key={i} initial={{ height: 0 }}
                animate={{ height: `${Math.min(100, Math.abs(v) * 900)}%` }}
                style={{ flex: 1, borderRadius: 2, minHeight: 3, background: v >= 0 ? T.amber : T.violet, alignSelf: v >= 0 ? "flex-end" : "flex-start" }}
                title={v.toFixed(4)}
              />
            ))}
          </div>
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.fgMuted, marginTop: 9 }}>
            same model, same space — the question becomes the amber point in the 3D view
          </p>
        </Sec>
      )}
    </>
  );
}

function RetrieveView() {
  const candidates = usePipelineView(s => s.candidates);
  const results = usePipelineView(s => s.results);
  const params = useRagStore(s => s.params);
  const setHoverChunk = useRagStore(s => s.setHoverChunk);
  if (candidates.length === 0) return <Body>Run a question to score every chunk against it.</Body>;
  const top = candidates.slice(0, 10);
  const hits = new Set(results);
  return (
    <>
      <Sec title={`Scores — α=${params.hybridAlpha.toFixed(2)} · threshold ${params.threshold.toFixed(2)} · top-${params.topK}`}>
        {top.map(c => (
          <div
            key={c.chunkId}
            onMouseEnter={() => setHoverChunk(c.chunkId)}
            onMouseLeave={() => setHoverChunk(null)}
            style={{
              padding: "10px 12px", borderRadius: 10, marginBottom: 8,
              background: hits.has(c.chunkId) ? "rgba(5,150,105,0.06)" : T.inset,
              border: `1px solid ${hits.has(c.chunkId) ? "rgba(5,150,105,0.4)" : T.border}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: hits.has(c.chunkId) ? T.green : T.fgSec }}>
                #{c.rank} · chunk {c.chunkId} {hits.has(c.chunkId) ? "· RETRIEVED" : c.hybrid < params.threshold ? "· below threshold" : ""}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.fg, fontWeight: 700 }}>{c.hybrid.toFixed(3)}</span>
            </div>
            <Bar label="semantic (cosine)" value={c.semantic} max={1} color={T.blue} suffix={c.semantic.toFixed(3)} />
            <Bar label="keyword (BM25)" value={c.keyword} max={1} color={T.cyan} suffix={c.keyword.toFixed(3)} />
          </div>
        ))}
      </Sec>
    </>
  );
}

function RerankView() {
  const candidates = usePipelineView(s => s.candidates);
  const params = useRagStore(s => s.params);
  const pool = candidates
    .filter(c => c.hybrid >= params.threshold)
    .slice(0, Math.min(params.topK + RERANK_POOL_EXTRA, 12));
  const scored = pool.filter(c => c.rerankScore !== undefined);
  if (!params.useRerank) return <Body>Re-ranking is disabled in the parameters panel. The hybrid order is used as-is.</Body>;
  if (scored.length === 0) return <Body>No re-rank scores yet — ask a question with re-ranking enabled.</Body>;
  const after = [...scored].sort((a, b) => (a.rerankRank ?? 99) - (b.rerankRank ?? 99));
  return (
    <Sec title="Before (hybrid) → After (GPT-5 mini)">
      {after.map(c => {
        const before = pool.findIndex(p => p.chunkId === c.chunkId) + 1;
        const now = c.rerankRank ?? before;
        const delta = before - now;
        return (
          <div key={c.chunkId} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            borderRadius: 10, marginBottom: 7, background: T.inset, border: `1px solid ${T.border}`,
          }}>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.fgMuted, width: 52 }}>#{before}→#{now}</span>
            <span style={{
              fontFamily: T.mono, fontSize: 12.5, width: 30, textAlign: "center", fontWeight: 700,
              color: delta > 0 ? T.green : delta < 0 ? T.red : T.fgMuted,
            }}>
              {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${-delta}` : "＝"}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.fgSec, flex: 1 }}>chunk {c.chunkId}</span>
            <span style={{
              fontFamily: T.mono, fontSize: 12.5, padding: "3px 10px", borderRadius: 8, fontWeight: 700,
              background: "rgba(124,58,237,0.09)", color: T.violet, border: "1px solid rgba(124,58,237,0.3)",
            }}>
              {c.rerankScore}
            </span>
          </div>
        );
      })}
    </Sec>
  );
}

function PromptView() {
  const blocks = usePipelineView(s => s.promptBlocks);
  if (blocks.length === 0) return <Body>The final prompt appears here once a question runs.</Body>;
  return (
    <>
      <Sec title="Prompt MRI — the assembled package, sliced open">
        <PromptMRI />
      </Sec>
      <Sec title="Context container — the budget as a vessel">
        <ContextContainer />
      </Sec>
    </>
  );
}

function GenerateView() {
  const answer = usePipelineView(s => s.answer);
  const stages = usePipelineView(s => s.stages);
  const usage = usePipelineView(s => s.usage);
  const setBrainOpen = useRagStore(s => s.setBrainOpen);
  const canBrain = !!answer || stages.generate.status === "running";
  return (
    <>
      {canBrain && (
        <Sec title="Generation theater">
          <button
            onClick={() => setBrainOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
              borderRadius: 11, cursor: "pointer",
              background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.5)",
              fontFamily: T.disp, fontWeight: 700, fontSize: 13.5, color: T.violet,
            }}
          >
            🧠 inside gpt&apos;s brain →
          </button>
          <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginTop: 7 }}>
            educational simulation — observable stages only, clearly labelled
          </p>
        </Sec>
      )}
      <Sec title="Model">
        <KV k="model" v="gemini flash" />
        <KV k="grounding" v="context-only + [n] citations" />
        <KV k="latency" v={stages.generate.ms ? `${(stages.generate.ms / 1000).toFixed(2)}s` : "—"} />
        <KV k="session tokens in/out" v={`${usage.promptTokens.toLocaleString()} / ${usage.completionTokens.toLocaleString()}`} />
        <KV k="session est. cost" v={`$${usage.costUSD.toFixed(5)}`} color={T.green} />
      </Sec>
      {answer && <Sec title="Raw answer"><Snippet text={answer} color="rgba(5,150,105,0.35)" /></Sec>}
    </>
  );
}

function GroundView() {
  const sentences = usePipelineView(s => s.answerSentences);
  const chunks = usePipelineView(s => s.chunks);
  const hoverChunk = useRagStore(s => s.hoverChunk);
  const setHoverChunk = useRagStore(s => s.setHoverChunk);
  if (sentences.length === 0) return <Body>Once an answer exists, every sentence is mapped back to its source chunks here.</Body>;
  const hovered = chunks.find(c => c.id === hoverChunk);
  return (
    <>
      <Sec title="Answer — hover a sentence to trace its evidence">
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {sentences.map((s, i) => (
            <span
              key={i}
              onMouseEnter={() => s.citations.length && setHoverChunk(s.citations[0])}
              onMouseLeave={() => setHoverChunk(null)}
              style={{
                fontSize: 14, lineHeight: 1.65, padding: "5px 8px", borderRadius: 8, cursor: s.citations.length ? "pointer" : "default",
                color: s.citations.length ? T.fg : T.fgSec,
                background: s.citations.includes(hoverChunk ?? -1) ? "rgba(5,150,105,0.1)" : "transparent",
                border: `1px solid ${s.citations.includes(hoverChunk ?? -1) ? "rgba(5,150,105,0.4)" : "transparent"}`,
              }}
            >
              {s.text}{" "}
              {s.citations.map(c => (
                <span key={c} style={{ fontFamily: T.mono, fontSize: 11, color: T.green, fontWeight: 700 }}>[{c}]</span>
              ))}
            </span>
          ))}
        </div>
      </Sec>
      {hovered && (
        <Sec title={`Source — chunk ${hovered.id} · page ${hovered.page}`}>
          <Snippet text={hovered.text} color="rgba(5,150,105,0.4)" />
        </Sec>
      )}
    </>
  );
}

function EvaluateView() {
  const ev = usePipelineView(s => s.evalScores);
  const verdicts = usePipelineView(s => s.sentenceVerdicts);
  if (!ev) return <Body>The LLM judge scores each answer automatically after generation.</Body>;
  const counts = verdicts
    ? {
        supported: verdicts.filter(v => v.support === "supported").length,
        partial: verdicts.filter(v => v.support === "partial").length,
        unsupported: verdicts.filter(v => v.support === "unsupported").length,
      }
    : null;
  const rows = [
    { k: "Faithfulness", v: ev.faithfulness, good: true },
    { k: "Answer relevance", v: ev.answerRelevance, good: true },
    { k: "Context precision", v: ev.contextPrecision, good: true },
    { k: "Context recall", v: ev.contextRecall, good: true },
    { k: "Hallucination risk", v: ev.hallucinationRisk, good: false },
  ];
  return (
    <>
      <Sec title="Hallucination radar">
        <EvalRadar scores={ev} />
      </Sec>
      <Sec title="LLM-as-judge scores (0–100)">
        {rows.map(r => {
          const ok = r.good ? r.v >= 70 : r.v <= 30;
          const color = ok ? T.green : (r.good ? r.v >= 45 : r.v <= 55) ? T.amber : T.red;
          return <Bar key={r.k} label={r.k} value={r.v} max={100} color={color} suffix={String(r.v)} />;
        })}
      </Sec>
      {counts && (
        <Sec title="Per-sentence verdicts">
          <KV k="supported" v={String(counts.supported)} color={T.green} />
          <KV k="partial" v={String(counts.partial)} color={T.amber} />
          <KV k="unsupported" v={String(counts.unsupported)} color={counts.unsupported > 0 ? T.red : T.fg} />
          <Body>Click any sentence in the answer to walk its evidence trail.</Body>
        </Sec>
      )}
      <Sec title="Verdict"><Body>{ev.verdict || "—"}</Body></Sec>
    </>
  );
}

const VIEWS: Record<StageId, () => React.ReactElement> = {
  upload: UploadView, parse: ParseView, clean: CleanView, chunk: ChunkView,
  tokenize: TokenizeView, embed: EmbedView, index: IndexView,
  query: QueryView, retrieve: RetrieveView, rerank: RerankView,
  prompt: PromptView, generate: GenerateView, ground: GroundView, evaluate: EvaluateView,
};

/* ── raw artifact view (engineer/researcher personas) ─────── */

function ArtifactJson({ id }: { id: StageId }) {
  // subscribe to the store object (stable snapshot) and derive during render —
  // a selector returning a fresh object every call breaks useSyncExternalStore
  const state = usePipelineView(v => v);
  const artifact = stageArtifact(state, id);
  return (
    <div>
      <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.fgMuted, marginBottom: 8 }}>
        live artifact — real pipeline data, truncated only where noted
      </p>
      <pre style={{
        padding: "13px 15px", background: T.inset, borderRadius: 10,
        border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11,
        lineHeight: 1.6, color: T.fgSec, whiteSpace: "pre-wrap", wordBreak: "break-word",
        maxHeight: 440, overflowY: "auto",
      }}>
        {JSON.stringify(artifact, null, 2)}
      </pre>
    </div>
  );
}

/* ── inspector shell ──────────────────────────────────────── */

export default function Inspector({ isMobile }: { isMobile: boolean }) {
  const selected = useRagStore(s => s.selected);
  const select = useRagStore(s => s.select);
  const stage = usePipelineView(s => (selected ? s.stages[selected] : null));
  const { showRawData } = usePersona();
  const [rawView, setRawView] = useState(false);
  // reset the raw tab when the node changes (render-time state adjustment)
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    setRawView(false);
  }
  const View = selected ? VIEWS[selected] : null;

  return (
    <AnimatePresence>
      {selected && (
        <motion.aside
          key={selected}
          initial={isMobile ? { y: "100%" } : { x: 40, opacity: 0 }}
          animate={isMobile ? { y: 0 } : { x: 0, opacity: 1 }}
          exit={isMobile ? { y: "100%" } : { x: 40, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={isMobile ? {
            position: "fixed", left: 0, right: 0, bottom: 0, top: "16vh", zIndex: 60,
            background: T.panel, borderTop: `1px solid ${T.borderStrong}`,
            borderRadius: "18px 18px 0 0", padding: "20px 18px 30px", overflowY: "auto",
            boxShadow: "0 -12px 40px rgba(15,23,42,0.18)",
          } : {
            width: 430, flexShrink: 0, alignSelf: "stretch",
            background: T.panel, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: "20px 20px 26px",
            maxHeight: "calc(100vh - 140px)", overflowY: "auto",
            position: "sticky", top: 84,
            boxShadow: T.cardShadow,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <p style={{ ...eyebrow, color: T.violet, marginBottom: 6 }}>
                {STAGE_BY_ID[selected].group} · node inspector
              </p>
              <h3 style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 25, color: T.fg, letterSpacing: "-0.03em", textTransform: "lowercase" }}>
                {STAGE_BY_ID[selected].title}.
              </h3>
            </div>
            <button onClick={() => select(null)} aria-label="Close inspector" style={{ ...navBtn, width: 32, height: 32 }}>
              <X size={16} />
            </button>
          </div>

          {stage?.ms !== undefined && (
            <p style={{ fontFamily: T.mono, fontSize: 12, color: T.green, marginBottom: 12, fontWeight: 600 }}>
              processed in {stage.ms >= 1000 ? `${(stage.ms / 1000).toFixed(2)}s` : `${stage.ms}ms`}
            </p>
          )}

          <div style={{ marginBottom: 18 }}>
            <Body>{STAGE_BY_ID[selected].explanation}</Body>
          </div>

          <ConceptBlock id={STAGE_CONCEPT[selected]} />

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20,
          }}>
            <div style={{ padding: "11px 13px", borderRadius: 10, background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.25)" }}>
              <p style={{ ...eyebrow, fontSize: 10.5, color: T.blue, marginBottom: 6 }}>input</p>
              <p style={{ fontSize: 12.5, color: T.fgSec, lineHeight: 1.55 }}>{STAGE_BY_ID[selected].inputDesc}</p>
            </div>
            <div style={{ padding: "11px 13px", borderRadius: 10, background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.25)" }}>
              <p style={{ ...eyebrow, fontSize: 10.5, color: T.green, marginBottom: 6 }}>output</p>
              <p style={{ fontSize: 12.5, color: T.fgSec, lineHeight: 1.55 }}>{STAGE_BY_ID[selected].outputDesc}</p>
            </div>
          </div>

          {stage?.status === "error" && (
            <div style={{ padding: "11px 13px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.35)", marginBottom: 18 }}>
              <p style={{ fontFamily: T.mono, fontSize: 12.5, color: T.red }}>{stage.error}</p>
            </div>
          )}

          {showRawData && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {([["explainer", false], ["raw json", true]] as const).map(([label, raw]) => (
                <button
                  key={label}
                  onClick={() => setRawView(raw)}
                  aria-pressed={rawView === raw}
                  style={{
                    padding: "7px 14px", borderRadius: 9, cursor: "pointer",
                    background: rawView === raw ? "rgba(37,99,235,0.07)" : "transparent",
                    border: `1px solid ${rawView === raw ? "rgba(37,99,235,0.45)" : T.border}`,
                    fontFamily: T.mono, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase",
                    color: rawView === raw ? T.blue : T.fgSec, fontWeight: 600,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {rawView && showRawData ? <ArtifactJson id={selected} /> : View && <View />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
