import { chat, errorResponse } from "../_lib/gemini";
import { parseSentenceVerdicts, MAX_VERDICT_SENTENCES } from "../_lib/verdicts";
import { guard } from "../_lib/gate";

export const runtime = "nodejs";



const SYSTEM = `You are a strict RAG evaluation judge. Given a question, the retrieved context, and the generated answer, score the exchange.
Return STRICT JSON only:
{"faithfulness":<0-100>,"answerRelevance":<0-100>,"contextPrecision":<0-100>,"contextRecall":<0-100>,"hallucinationRisk":<0-100>,"verdict":"<one sentence>","sentences":[{"support":"supported|partial|unsupported","evidence":[<chunk numbers>]}, ...]}
Definitions:
- faithfulness: every claim in the answer is supported by the context.
- answerRelevance: the answer actually addresses the question.
- contextPrecision: fraction of retrieved context that was relevant.
- contextRecall: whether the context contained everything needed.
- hallucinationRisk: likelihood the answer contains unsupported claims (higher = worse).
Per-sentence rubric ("sentences" — one entry per numbered sentence, same order):
- "supported": the claim is directly entailed by a context chunk; list those chunk numbers in "evidence".
- "partial": part of the claim is entailed, part is not; list the chunks that support the entailed part.
- "unsupported": no context chunk entails this claim; "evidence" is [].
Judge each sentence against the CONTEXT ONLY — not against your own knowledge.`;

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const question = String(body?.question ?? "").slice(0, 2000);
    const context = String(body?.context ?? "").slice(0, 24000);
    const answer = String(body?.answer ?? "").slice(0, 8000);
    const sentences: string[] = Array.isArray(body?.sentences)
      ? (body.sentences as unknown[]).slice(0, MAX_VERDICT_SENTENCES).map(s => String(s).slice(0, 600))
      : [];
    if (!question || !answer) {
      return Response.json({ error: "question and answer are required" }, { status: 400 });
    }

    const sentenceBlock = sentences.length
      ? `\n\nAnswer sentences to judge individually:\n${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";
    const user = `Question:\n${question}\n\nRetrieved context:\n${context}\n\nGenerated answer:\n${answer}${sentenceBlock}`;
    const result = await chat(SYSTEM, user, { maxTokens: 400 + sentences.length * 40, jsonMode: true });

    let scores: Record<string, number | string> | null = null;
    let sentenceVerdicts: ReturnType<typeof parseSentenceVerdicts> = null;
    try {
      const parsed = JSON.parse(result.text);
      const num = (x: unknown) => Math.min(100, Math.max(0, Math.round(Number(x)) || 0));
      scores = {
        faithfulness: num(parsed.faithfulness),
        answerRelevance: num(parsed.answerRelevance),
        contextPrecision: num(parsed.contextPrecision),
        contextRecall: num(parsed.contextRecall),
        hallucinationRisk: num(parsed.hallucinationRisk),
        verdict: String(parsed.verdict ?? "").slice(0, 300),
      };
      // malformed per-sentence output degrades to doc-level only (M9)
      sentenceVerdicts = parseSentenceVerdicts(parsed.sentences, sentences.length);
    } catch {
      // malformed judge output — surface as evaluation failure
    }

    if (!scores) return Response.json({ error: "judge returned malformed output" }, { status: 502 });

    return Response.json({
      scores,
      sentenceVerdicts,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
