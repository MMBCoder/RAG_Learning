"use client";

import type { PageText } from "../ragStore";
import type { DocKind } from "../store/types";
import { parsePdf, renderPdfPagesToJpeg } from "./pdf";

/** Optional progress reporter for slow stages (e.g. per-page OCR). */
export type ParseProgress = (note: string) => void;

/* Multi-format ingestion. Each format is reduced to PageText[] so the rest
   of the pipeline (clean → chunk → embed) stays format-agnostic.

   - PDF        → pdf.js text extraction (one PageText per page)
   - Word .docx → mammoth raw-text extraction, paginated
   - Excel      → SheetJS, one PageText per sheet (all sheets covered)
   - Markdown / text → decoded and paginated
   - Images     → Gemini vision on the server (/api/rag/extract-image) */

const EXT: Record<string, DocKind> = {
  pdf: "pdf",
  docx: "word",
  xlsx: "excel", xls: "excel", csv: "excel",
  md: "markdown", markdown: "markdown", mdx: "markdown",
  txt: "text",
  png: "image", jpg: "image", jpeg: "image", webp: "image", gif: "image", bmp: "image",
};

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", bmp: "image/bmp",
};

export const ACCEPT_ATTR =
  ".pdf,.docx,.xlsx,.xls,.csv,.md,.markdown,.mdx,.txt,.png,.jpg,.jpeg,.webp,.gif";

export function extOf(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

export function kindFromName(name: string): DocKind {
  return EXT[extOf(name)] ?? null;
}

/** Human label for the "pages" unit, per format. */
export function unitLabel(kind: DocKind, n: number): string {
  const one = n === 1;
  switch (kind) {
    case "pdf": return one ? "page" : "pages";
    case "excel": return one ? "sheet" : "sheets";
    case "image": return "image";
    default: return one ? "section" : "sections";
  }
}

export async function parseByKind(
  kind: DocKind,
  data: ArrayBuffer,
  name: string,
  onProgress?: ParseProgress,
): Promise<PageText[]> {
  switch (kind) {
    case "pdf": return parsePdfWithOcr(data, onProgress);
    case "excel": return parseSpreadsheet(data);
    case "word": return parseDocx(data);
    case "markdown":
    case "text": return paginate(new TextDecoder().decode(data));
    case "image": return parseImage(data, name);
    default: throw new Error("Unsupported file type. Use PDF, Word, Excel, Markdown, text, or an image.");
  }
}

/* ── PDF — text layer first, OCR fallback for scans ─────────── */
/* Most PDFs carry a selectable text layer that pdf.js reads directly. But
   scanned or "printed-to-PDF" documents are just page images with no text
   at all. Rather than dead-ending with "looks like a scan", we render each
   page to an image and run the same Gemini-vision OCR used for image uploads. */
async function parsePdfWithOcr(data: ArrayBuffer, onProgress?: ParseProgress): Promise<PageText[]> {
  const { pages } = await parsePdf(data);
  const textChars = pages.reduce((n, p) => n + p.text.trim().length, 0);
  if (textChars >= 20) return pages;                     // real text layer — use it

  onProgress?.("no text layer — running OCR…");
  const images = await renderPdfPagesToJpeg(data, {
    maxPages: 20,
    onPage: (n, total) => onProgress?.(`rendering page ${n}/${total} for OCR…`),
  });

  const ocr: PageText[] = [];
  for (let i = 0; i < images.length; i++) {
    const b64 = images[i];
    if (!b64) continue;
    onProgress?.(`reading page ${i + 1}/${images.length} with OCR…`);
    try {
      const res = await fetch("/api/rag/extract-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mime: "image/jpeg", data: b64 }),
      });
      if (!res.ok) continue;
      const { text } = await res.json();
      const clean = String(text ?? "").trim();
      if (clean.length >= 3) ocr.push({ page: i + 1, text: clean });
    } catch {
      /* skip a page that failed to OCR; keep going with the rest */
    }
  }

  if (ocr.reduce((n, p) => n + p.text.length, 0) < 20) {
    throw new Error("No selectable text found, and OCR could not read this scanned PDF.");
  }
  return ocr;
}

/* ── Excel — every sheet becomes a page ─────────────────────── */
async function parseSpreadsheet(data: ArrayBuffer): Promise<PageText[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(data), { type: "array" });
  const pages: PageText[] = [];
  wb.SheetNames.forEach((name, i) => {
    const ws = wb.Sheets[name];
    if (!ws) return;
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false }).trim();
    if (csv) pages.push({ page: i + 1, text: `Sheet: ${name}\n${csv}` });
  });
  if (pages.length === 0) throw new Error("No data found in the spreadsheet.");
  return pages;
}

/* ── Word — full document text, paginated ───────────────────── */
async function parseDocx(data: ArrayBuffer): Promise<PageText[]> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: data });
  const text = value.trim();
  if (text.length < 20) throw new Error("No selectable text found in this Word document.");
  return paginate(text);
}

/* ── Images — Gemini vision transcription on the server ─────── */
async function parseImage(data: ArrayBuffer, name: string): Promise<PageText[]> {
  const mime = IMAGE_MIME[extOf(name)] ?? "image/png";
  const res = await fetch("/api/rag/extract-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mime, data: toBase64(data) }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || "Could not read the image.");
  }
  const { text } = await res.json();
  const clean = String(text ?? "").trim();
  if (clean.length < 5) throw new Error("No readable text or content found in the image.");
  return paginate(clean);
}

/* ── helpers ────────────────────────────────────────────────── */

/** Split free text into ~page-sized sections on paragraph boundaries so
    long documents still show multiple "pages" in the visualizer. */
function paginate(text: string, target = 3000): PageText[] {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const pages: PageText[] = [];
  let buf = "";
  let page = 1;
  for (const p of paras) {
    if (buf && buf.length + p.length > target) {
      pages.push({ page: page++, text: buf.trim() });
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + p;
  }
  if (buf.trim()) pages.push({ page, text: buf.trim() });
  if (pages.length === 0) pages.push({ page: 1, text: text.trim() });
  return pages;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
