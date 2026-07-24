"use client";

import type { PageText } from "../ragStore";

/* PDF.js is loaded lazily in the browser only. The worker file is served
   from /public (copied from node_modules/pdfjs-dist/build). */

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

async function getPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then(m => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

export interface ParsedPdf {
  pages: PageText[];
  numPages: number;
}

export async function parsePdf(data: ArrayBuffer): Promise<ParsedPdf> {
  const pdfjs = await getPdfJs();
  // pdf.js transfers the buffer to its worker, so hand it a copy
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const pages: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s{2,}/g, " ");
    pages.push({ page: i, text });
  }
  return { pages, numPages: doc.numPages };
}

/** Render each page to a JPEG (base64, no data: prefix) for the OCR fallback
    used on scanned / rasterised PDFs that carry no selectable text layer
    (e.g. "Microsoft Print to PDF" output, which is just page images). */
export async function renderPdfPagesToJpeg(
  data: ArrayBuffer,
  opts: { maxPages?: number; maxWidth?: number; quality?: number; onPage?: (n: number, total: number) => void } = {},
): Promise<string[]> {
  const { maxPages = 20, maxWidth = 1600, quality = 0.85, onPage } = opts;
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const total = Math.min(doc.numPages, maxPages);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const out: string[] = [];
  for (let i = 1; i <= total; i++) {
    onPage?.(i, total);
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxWidth / base.width, 3);   // upscale a little for OCR, but cap it
    const viewport = page.getViewport({ scale });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    out.push(canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "");
  }
  return out;
}

/** Render one page of the PDF into a canvas element (for previews). */
export async function renderPdfPage(
  data: ArrayBuffer,
  pageNum: number,
  canvas: HTMLCanvasElement,
  maxWidth: number,
): Promise<void> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const page = await doc.getPage(Math.min(Math.max(1, pageNum), doc.numPages));
  const base = page.getViewport({ scale: 1 });
  const scale = maxWidth / base.width;
  const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${maxWidth}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
}
