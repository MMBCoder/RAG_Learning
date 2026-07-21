import crypto from "node:crypto";

/* Access gate + soft rate limit for the credit-spending /api/rag routes.

   Passphrase: set RAG_ACCESS_CODE on the server to require a shared code
   before any pipeline call runs. Unset (local dev, CI) → the gate is
   OPEN, so nothing here affects local work or the mocked E2E suite.

   The client unlocks once via POST /api/rag/gate; the server sets an
   httpOnly cookie holding sha256(code), so the raw passphrase never
   lives in client-readable storage and is never echoed back. */

const COOKIE = "rag_access";
const SESSION_SECONDS = 12 * 60 * 60;   // 12h unlock

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** true when a passphrase is configured (i.e. the lab is gated). */
export function accessRequired(): boolean {
  return !!process.env.RAG_ACCESS_CODE;
}

function expectedToken(): string | null {
  const code = process.env.RAG_ACCESS_CODE;
  return code ? sha(code) : null;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** true when the request carries a valid unlock cookie (or no gate is set). */
export function isUnlocked(req: Request): boolean {
  const expected = expectedToken();
  if (!expected) return true;                 // no code configured → open
  const tok = readCookie(req, COOKIE);
  return !!tok && safeEqual(tok, expected);
}

/** Verify a submitted passphrase against the configured one (constant-time). */
export function verifyCode(code: string): boolean {
  const expected = expectedToken();
  if (!expected) return true;
  return safeEqual(sha(code), expected);
}

/** Set-Cookie header value that unlocks the session. */
export function unlockCookie(): string {
  const token = expectedToken() ?? "";
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE}=${token}; Path=/api/rag; HttpOnly;${secure} SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

/* ── soft per-IP rate limit (defense-in-depth for a shared passphrase) ──
   Best-effort: serverless instances don't share memory, so this caps a
   single warm instance, not the fleet. Good enough to blunt a runaway
   loop; pair with a real limiter (Upstash/Vercel KV) for hard limits. */

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function limitPerMinute(): number {
  const n = Number(process.env.RAG_RATE_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimited(req: Request): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();          // crude memory bound
  return recent.length > limitPerMinute();
}

/** Gate + rate-limit guard for a route. Returns a Response to short-circuit
    with, or null when the request may proceed. */
export function guard(req: Request): Response | null {
  if (!isUnlocked(req)) {
    return Response.json(
      { error: "This lab is access-gated. Enter the passphrase to continue.", code: "locked" },
      { status: 401 },
    );
  }
  if (rateLimited(req)) {
    return Response.json(
      { error: "Rate limit reached — please slow down for a moment.", code: "rate_limited" },
      { status: 429 },
    );
  }
  return null;
}
