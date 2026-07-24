import { upload } from "@vercel/blob/client";

/* Best-effort capture of an uploaded file to Vercel Blob. Fire-and-forget:
   it must never block ingestion or surface an error to the visitor. If no Blob
   store is connected, the token route returns 501 and this quietly gives up. */

export function captureUpload(file: File): void {
  const safe = (file.name || "upload").replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const day = new Date().toISOString().slice(0, 10);           // YYYY-MM-DD folder
  const key = `rag-uploads/${day}/${Date.now()}-${safe}`;
  void upload(key, file, {
    access: "private",                   // requires authentication to read; review in the Blob dashboard
    handleUploadUrl: "/api/rag/store-upload",
    contentType: file.type || undefined,
  }).catch(() => {
    /* storage is optional — ignore any failure (no store, offline, blocked) */
  });
}
