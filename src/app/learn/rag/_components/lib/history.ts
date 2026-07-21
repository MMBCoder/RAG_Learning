import type { PipelineEvent } from "../store/eventsSlice";
import type { StageId } from "../ragStore";

/* ═══════════════════════════════════════════════════════════════════
   MEMORY CLUSTER (M11) — the document develops a history.

   All of it is a PURE PROJECTION of the M4 event log: no second
   bookkeeping store, nothing to desynchronize, and a new document
   resets history automatically because ingestion clears the log.
   Derivations read the last MAX_RUNS query runs (ring-buffer cap).
   ═══════════════════════════════════════════════════════════════════ */

export const MAX_RUNS = 50;

export interface ChunkQueryRecord {
  runId: number;
  query: string;
  sim: number | null;     // semantic similarity for that question
  retrieved: boolean;
  cited: boolean;
}

export interface ChunkHistory {
  id: number;
  page: number;
  records: ChunkQueryRecord[];   // one per question, chronological
  retrievedCount: number;
  citedCount: number;
}

/** The completed query runs (evaluate — or at least ground — landed). */
export function queryRuns(events: PipelineEvent[]): PipelineEvent[] {
  const finals = new Map<number, PipelineEvent>();
  for (const e of events) {
    if (e.runKind !== "query" || e.kind !== "stage-done") continue;
    if (e.stage === "ground" || e.stage === "evaluate") finals.set(e.runId, e);
  }
  return [...finals.values()].slice(-MAX_RUNS);
}

export function chunkHistories(events: PipelineEvent[]): Map<number, ChunkHistory> {
  const out = new Map<number, ChunkHistory>();
  for (const run of queryRuns(events)) {
    const snap = run.snapshot;
    const retrieved = new Set(snap.results);
    const cited = new Set(snap.answerSentences.flatMap(s => s.citations));
    const simById = new Map(snap.candidates.map(c => [c.chunkId, c.semantic]));
    for (const c of snap.chunks) {
      const h = out.get(c.id) ?? { id: c.id, page: c.page, records: [], retrievedCount: 0, citedCount: 0 };
      const rec: ChunkQueryRecord = {
        runId: run.runId,
        query: snap.query,
        sim: simById.get(c.id) ?? null,
        retrieved: retrieved.has(c.id),
        cited: cited.has(c.id),
      };
      h.records.push(rec);
      if (rec.retrieved) h.retrievedCount++;
      if (rec.cited) h.citedCount++;
      out.set(c.id, h);
    }
  }
  return out;
}

export interface PageHeatCell {
  page: number;
  count: number;                                  // retrievals landing on this page
  chunks: { id: number; count: number }[];        // per-chunk drill-down
}

export function pageHeat(events: PipelineEvent[]): PageHeatCell[] {
  const byPage = new Map<number, PageHeatCell>();
  for (const run of queryRuns(events)) {
    const snap = run.snapshot;
    const byId = new Map(snap.chunks.map(c => [c.id, c]));
    for (const id of snap.results) {
      const c = byId.get(id);
      if (!c) continue;
      const cell = byPage.get(c.page) ?? { page: c.page, count: 0, chunks: [] };
      cell.count++;
      const cc = cell.chunks.find(x => x.id === id);
      if (cc) cc.count++;
      else cell.chunks.push({ id, count: 1 });
      byPage.set(c.page, cell);
    }
  }
  // every page appears, even cold ones, so the SHAPE of the doc reads
  const latest = queryRuns(events).at(-1)?.snapshot.pages ?? [];
  for (const p of latest) {
    if (!byPage.has(p.page)) byPage.set(p.page, { page: p.page, count: 0, chunks: [] });
  }
  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

/** Sequential heat tint — pure, testable. 0 = cold (transparent). */
export function heatColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return "rgba(37,99,235,0.05)";
  const t = Math.min(1, count / max);
  return `rgba(217,${Math.round(119 - 60 * t)},6,${(0.15 + 0.6 * t).toFixed(2)})`;
}

/** Real per-stage duration samples across ALL recorded runs. */
export function latencySamples(events: PipelineEvent[]): Partial<Record<StageId, number[]>> {
  const out: Partial<Record<StageId, number[]>> = {};
  for (const e of events.slice(-MAX_RUNS * 14)) {
    if (e.kind !== "stage-done" || !e.stage || typeof e.ms !== "number") continue;
    (out[e.stage] ??= []).push(e.ms);
  }
  return out;
}
