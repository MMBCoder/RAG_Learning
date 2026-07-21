import { errorResponse, embedTexts } from "../_lib/gemini";
import { guard } from "../_lib/gate";

export const runtime = "nodejs";

const MAX_TEXTS = 200;
const MAX_CHARS = 6000;

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const texts: unknown = body?.texts;
    if (!Array.isArray(texts) || texts.length === 0) {
      return Response.json({ error: "texts must be a non-empty array" }, { status: 400 });
    }
    if (texts.length > MAX_TEXTS) {
      return Response.json({ error: `too many texts (max ${MAX_TEXTS})` }, { status: 400 });
    }
    const clean = texts.map(t => String(t).slice(0, MAX_CHARS));

    const { vectors, tokens } = await embedTexts(clean);
    return Response.json({ vectors, tokens });
  } catch (e) {
    return errorResponse(e);
  }
}
