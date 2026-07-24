import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

/* Mints short-lived tokens so the browser can upload the raw file straight to
   Vercel Blob (bypassing the ~4.5 MB serverless body limit). Storing uploads is
   best-effort and opt-in: if no Blob store is connected (no BLOB_READ_WRITE_TOKEN),
   this route no-ops so the lab keeps working unchanged. */

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Blob storage not provisioned yet — tell the client to skip quietly.
    return Response.json({ error: "blob storage not configured" }, { status: 501 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        // private access (set on the client upload); capped at the uploader's 10 MB
        maximumSizeInBytes: 10 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      // Persisted on upload regardless; the callback only fires on a public URL
      // (not on localhost), so keep it a no-op.
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
