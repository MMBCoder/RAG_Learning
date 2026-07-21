import { chat, errorResponse } from "../_lib/gemini";
import { guard } from "../_lib/gate";

export const runtime = "nodejs";

const SYSTEM = `You are a retrieval re-ranker. Score each candidate passage for how well it answers the user's question.
Return STRICT JSON: {"scores":[{"id":<candidate id>,"score":<0-100 integer>}]} with one entry per candidate. No other text.`;

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const query = String(body?.query ?? "").slice(0, 2000);
    const candidates: { id: number; text: string }[] = Array.isArray(body?.candidates)
      ? body.candidates.slice(0, 16).map((c: { id: number; text: string }) => ({
          id: Number(c.id),
          text: String(c.text).slice(0, 1500),
        }))
      : [];
    if (!query || candidates.length === 0) {
      return Response.json({ error: "query and candidates are required" }, { status: 400 });
    }

    const user = `Question: ${query}\n\nCandidates:\n${candidates
      .map(c => `[${c.id}] ${c.text}`)
      .join("\n\n")}`;

    const result = await chat(SYSTEM, user, { maxTokens: 500, jsonMode: true });

    let scores: { id: number; score: number }[] = [];
    try {
      const parsed = JSON.parse(result.text);
      if (Array.isArray(parsed?.scores)) {
        scores = parsed.scores
          .map((s: { id: number; score: number }) => ({
            id: Number(s.id),
            score: Math.min(100, Math.max(0, Number(s.score))),
          }))
          .filter((s: { id: number; score: number }) => Number.isFinite(s.id) && Number.isFinite(s.score));
      }
    } catch {
      // model returned malformed JSON — client falls back to hybrid order
    }

    return Response.json({
      scores,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
