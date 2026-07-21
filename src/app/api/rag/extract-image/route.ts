import { errorResponse, extractImageText } from "../_lib/gemini";
import { guard } from "../_lib/gate";

export const runtime = "nodejs";

// base64 of a 5 MB image is ~6.7 MB of text; cap the request body generously.
const MAX_B64 = 9_000_000;

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const data: unknown = body?.data;
    const mime: string = typeof body?.mime === "string" ? body.mime : "image/png";
    if (typeof data !== "string" || data.length === 0) {
      return Response.json({ error: "No image data provided." }, { status: 400 });
    }
    if (data.length > MAX_B64) {
      return Response.json({ error: "Image is too large." }, { status: 413 });
    }
    const text = await extractImageText(mime, data);
    return Response.json({ text });
  } catch (e) {
    return errorResponse(e);
  }
}
