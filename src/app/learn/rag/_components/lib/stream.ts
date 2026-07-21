/* NDJSON stream consumption (M10). The parser is pure and incremental —
   frames split across network chunks reassemble correctly (unit-tested
   with adversarial splits). */

export interface StreamTotals {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export type StreamFrame =
  | { delta: string }
  | { done: true; promptTokens: number; completionTokens: number }
  | { error: string };

export class NdjsonParser {
  private buffer = "";

  /** Feed a raw chunk; returns every COMPLETE frame it contained. */
  push(chunk: string): StreamFrame[] {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    const frames: StreamFrame[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        frames.push(JSON.parse(t) as StreamFrame);
      } catch {
        // a malformed line is a protocol error — surface, don't guess
        frames.push({ error: "malformed stream frame" });
      }
    }
    return frames;
  }
}

/** Ordered chunk ids by FIRST appearance of their [n] citation marker —
    drives the brain's evidence-selection act as markers stream in. */
export function citationsInText(text: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const m of text.matchAll(/\[(\d+)\]/g)) {
    const id = Number(m[1]);
    if (!seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
}

/** Drain a fetch Response of NDJSON frames. onDelta fires per token
    chunk with the accumulated text. Throws on frame errors. */
export async function consumeNdjson(
  res: Response,
  onDelta: (accumulated: string, delta: string) => void,
): Promise<StreamTotals> {
  if (!res.body) throw new Error("response has no body to stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new NdjsonParser();
  let text = "";
  let promptTokens = 0;
  let completionTokens = 0;

  for (;;) {
    const { value, done } = await reader.read();
    const frames = parser.push(done ? "\n" : decoder.decode(value, { stream: true }));
    for (const f of frames) {
      if ("error" in f) throw new Error(f.error);
      if ("delta" in f) {
        text += f.delta;
        onDelta(text, f.delta);
      }
      if ("done" in f) {
        promptTokens = f.promptTokens;
        completionTokens = f.completionTokens;
      }
    }
    if (done) break;
  }
  return { text, promptTokens, completionTokens };
}
