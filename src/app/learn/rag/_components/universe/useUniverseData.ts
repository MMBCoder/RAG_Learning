"use client";

import { useEffect, useMemo, useState } from "react";
import { usePipelineView } from "../timeline/usePipelineView";
import { queryCoord } from "../lib/pipeline";
import { kmeansAsync } from "../lib/workers/workerClient";
import { clusterLabels } from "./clusterLabels";

/* One derivation feeds BOTH renderings of the universe — the 3D scene
   and the accessible data table carry identical information (a11y
   parity is an acceptance criterion, not an afterthought). */

export interface UniverseChunk {
  id: number;
  index: number;
  pos: [number, number, number];
  page: number;
  tokens: number;
  preview: string;
  sim: number | null;       // semantic similarity vs current query
  retrieved: boolean;
  cited: boolean;
  cluster: number;
}

export interface UniverseCluster {
  label: string;
  centroid: [number, number, number];
  radius: number;
  count: number;
}

export interface UniverseData {
  chunks: UniverseChunk[];
  clusters: UniverseCluster[];
  queryPos: [number, number, number] | null;
  hasQuery: boolean;
}

const clusterCountFor = (n: number) => (n < 12 ? 2 : n < 60 ? 4 : 6);

export function useUniverseData(): UniverseData {
  const chunks = usePipelineView(s => s.chunks);
  const coords = usePipelineView(s => s.coords3);
  const results = usePipelineView(s => s.results);
  const candidates = usePipelineView(s => s.candidates);
  const sentences = usePipelineView(s => s.answerSentences);
  const queryVec = usePipelineView(s => s.queryVec);

  const [clustering, setClustering] = useState<{ assign: number[]; labels: string[]; centroids: [number, number, number][]; for: unknown } | null>(null);

  // k-means runs in the analysis worker whenever the projection changes.
  // No synchronous reset needed: consumers ignore results whose `for`
  // tag doesn't match the current coords.
  useEffect(() => {
    let alive = true;
    if (coords.length < 8) return;
    const k = clusterCountFor(coords.length);
    void kmeansAsync(coords, k).then(r => {
      if (!alive) return;
      const labels = clusterLabels(chunks.map(c => c.text), r.assign, r.centroids.length);
      setClustering({ assign: r.assign, labels, centroids: r.centroids, for: coords });
    });
    return () => { alive = false; };
  }, [coords, chunks]);

  return useMemo(() => {
    const retrieved = new Set(results);
    const cited = new Set(sentences.flatMap(s => s.citations));
    const simById = new Map(candidates.map(c => [c.chunkId, c.semantic]));
    const valid = clustering && clustering.for === coords ? clustering : null;

    const data: UniverseChunk[] = coords.map((p, i) => {
      const c = chunks[i];
      return {
        id: c?.id ?? i + 1,
        index: i,
        pos: p,
        page: c?.page ?? 0,
        tokens: c?.tokens ?? 0,
        preview: c?.text.slice(0, 110) ?? "",
        sim: simById.get(c?.id ?? -1) ?? null,
        retrieved: retrieved.has(c?.id ?? -1),
        cited: cited.has(c?.id ?? -1),
        cluster: valid?.assign[i] ?? 0,
      };
    });

    const clusters: UniverseCluster[] = valid
      ? valid.centroids.map((centroid, ci) => {
          const members = data.filter(d => d.cluster === ci);
          const radius = members.reduce((m, d) => Math.max(
            m,
            Math.hypot(d.pos[0] - centroid[0], d.pos[1] - centroid[1], d.pos[2] - centroid[2]),
          ), 0.08);
          return { label: valid.labels[ci], centroid, radius: Math.min(radius, 0.9), count: members.length };
        }).filter(c => c.count > 0)
      : [];

    return {
      chunks: data,
      clusters,
      queryPos: queryVec ? queryCoord() : null,
      hasQuery: !!queryVec,
    };
  }, [chunks, coords, results, candidates, sentences, queryVec, clustering]);
}
