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
