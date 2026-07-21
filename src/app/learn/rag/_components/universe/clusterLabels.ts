/* Cluster labels from REAL term frequency (M7): each k-means cluster is
   named by the terms its chunks actually use most — never invented
   topic names. Pure and fixture-tested. */

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "are", "was", "for",
  "on", "with", "at", "by", "it", "its", "as", "be", "this", "that", "what",
  "which", "how", "do", "does", "can", "i", "my", "you", "your", "from",
  "will", "has", "have", "had", "not", "but", "if", "when", "all", "any",
  "may", "more", "their", "there", "than", "then", "also", "into", "each",
]);

function terms(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z0-9]+/g)?.filter(t => !STOP.has(t) && t.length > 3) ?? [];
}

/** Top-`top` characteristic terms per cluster, by in-cluster frequency
    weighted against corpus-wide frequency (a TF·IDF-flavoured score so
    "card" doesn't label every cluster of a credit-card document). */
export function clusterLabels(texts: string[], assign: number[], k: number, top = 2): string[] {
  const global = new Map<string, number>();
  const perCluster: Map<string, number>[] = Array.from({ length: k }, () => new Map());

  texts.forEach((text, i) => {
    const c = assign[i];
    if (c === undefined || c < 0 || c >= k) return;
    for (const t of terms(text)) {
      global.set(t, (global.get(t) ?? 0) + 1);
      perCluster[c].set(t, (perCluster[c].get(t) ?? 0) + 1);
    }
  });

  return perCluster.map(counts => {
    const scored = [...counts.entries()]
      .map(([t, f]) => {
        const share = f / (global.get(t) ?? 1);   // 1 = exclusive to this cluster
        return [t, f * share * share] as const;
      })
      .sort((a, b) => b[1] - a[1]);
    const picked = scored.slice(0, top).map(([t]) => t);
    return picked.length ? picked.join(" · ") : "…";
  });
}
