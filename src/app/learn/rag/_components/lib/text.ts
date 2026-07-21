import type { Chunk, PageText } from "../ragStore";

/* ── cleaning ─────────────────────────────────────────────── */

export interface CleanResult {
  pages: PageText[];
  stats: { before: number; after: number; joinedLines: number; fixedHyphens: number };
}

export function cleanPages(pages: PageText[]): CleanResult {
  let joinedLines = 0;
  let fixedHyphens = 0;
  const before = pages.reduce((n, p) => n + p.text.length, 0);

  const cleaned = pages.map(p => {
    let t = p.text;
    // de-hyphenate words broken across line ends: "informa-\ntion" -> "information"
    t = t.replace(/(\w)-\n(\w)/g, (_m, a: string, b: string) => { fixedHyphens++; return a + b; });
    // join single line breaks inside sentences into spaces
    t = t.replace(/([^\n.!?:])\n(?!\n)/g, (_m, a: string) => { joinedLines++; return a + " "; });
    // strip control chars, normalise whitespace
    t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    t = t.replace(/[ \t]{2,}/g, " ");
    t = t.replace(/\n{3,}/g, "\n\n");
    return { page: p.page, text: t.trim() };
  });

  const after = cleaned.reduce((n, p) => n + p.text.length, 0);
  return { pages: cleaned, stats: { before, after, joinedLines, fixedHyphens } };
}

/* ── tokens (cl100k-style estimate) ───────────────────────── */

export function approxTokens(text: string): number {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(0.45 * words + 0.55 * (text.length / 4)));
}

/** Split text into displayable pseudo-tokens (for the tokenization animation). */
export function pseudoTokens(text: string): string[] {
  const out: string[] = [];
  const parts = text.match(/\s+|[\w'-]+|[^\s\w]/g) ?? [];
  for (const p of parts) {
    if (/^\s+$/.test(p)) continue;
    if (p.length <= 5) { out.push(p); continue; }
    // break long words into 3–5 char sub-word pieces, BPE-style
    let i = 0;
    while (i < p.length) {
      const len = Math.min(p.length - i, i === 0 ? 4 : 3 + ((p.charCodeAt(i) + i) % 3));
      out.push((i === 0 ? "" : "##") + p.slice(i, i + len));
      i += len;
    }
  }
  return out;
}

/* ── sentence splitting ───────────────────────────────────── */

export function splitSentences(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'([])/g);
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

/* ── chunking ─────────────────────────────────────────────── */

/** Hard ceiling, honestly enforced (M6: was a soft 150 that sentence
    rounding could overshoot — see the characterization note in tests). */
export const MAX_CHUNKS = 1000;

export function chunkPages(
  pages: PageText[],
  targetSize: number,
  overlap: number,
): Chunk[] {
  // grow the effective target until the ceiling actually holds
  let effTarget = targetSize;
  for (let attempt = 0; attempt < 8; attempt++) {
    const chunks = chunkOnce(pages, effTarget, overlap);
    if (chunks.length <= MAX_CHUNKS) return chunks;
    effTarget = Math.ceil(effTarget * ((chunks.length / MAX_CHUNKS) * 1.05));
  }
  return chunkOnce(pages, effTarget, overlap);
}

function chunkOnce(
  pages: PageText[],
  targetSize: number,
  overlap: number,
): Chunk[] {
  // flatten to sentences, remembering the page each sentence starts on
  const sentences: { text: string; page: number; start: number }[] = [];
  let offset = 0;
  for (const p of pages) {
    for (const s of splitSentences(p.text)) {
      sentences.push({ text: s, page: p.page, start: offset });
      offset += s.length + 1;
    }
  }
  if (sentences.length === 0) return [];

  // if the doc is huge, grow the effective size so we stay under MAX_CHUNKS
  const totalChars = offset;
  const effSize = Math.max(targetSize, Math.ceil(totalChars / MAX_CHUNKS));
  const effOverlap = Math.min(overlap, Math.floor(effSize / 2));

  const chunks: Chunk[] = [];
  let buf: typeof sentences = [];
  let bufLen = 0;

  const flush = () => {
    if (buf.length === 0) return;
    const text = buf.map(s => s.text).join(" ");
    const prev = chunks[chunks.length - 1];
    const overlapChars = prev ? Math.max(0, prev.start + prev.chars - buf[0].start) : 0;
    chunks.push({
      id: chunks.length + 1,
      text,
      page: buf[0].page,
      start: buf[0].start,
      chars: text.length,
      tokens: approxTokens(text),
      overlapChars,
    });
  };

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (bufLen + s.text.length > effSize && buf.length > 0) {
      flush();
      // carry back sentences to build the overlap window
      const kept: typeof sentences = [];
      let keptLen = 0;
      for (let j = buf.length - 1; j >= 0 && keptLen < effOverlap; j--) {
        kept.unshift(buf[j]);
        keptLen += buf[j].text.length;
      }
      buf = kept;
      bufLen = keptLen;
    }
    buf.push(s);
    bufLen += s.text.length;
  }
  flush();

  return chunks;
}
