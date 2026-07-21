import { accessRequired, isUnlocked, verifyCode, unlockCookie } from "../_lib/gate";

export const runtime = "nodejs";

/** Gate status: is the lab gated, and is this visitor already unlocked? */
export async function GET(req: Request) {
  return Response.json({ required: accessRequired(), unlocked: isUnlocked(req) });
}

/** Unlock with the shared passphrase; sets an httpOnly session cookie. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body?.code ?? "");
  if (!verifyCode(code)) {
    return Response.json({ error: "Incorrect passphrase." }, { status: 401 });
  }
  return new Response(JSON.stringify({ unlocked: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": unlockCookie() },
  });
}
