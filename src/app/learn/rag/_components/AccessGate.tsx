"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, KeyRound } from "lucide-react";
import { T, DEPTH, eyebrow } from "./theme";

/* Access gate (credit protection): if the server has a passphrase set
   (RAG_ACCESS_CODE), the lab is blocked until the visitor enters it. The
   server enforces the gate on every /api/rag route; this overlay is just
   the unlock UX. When no passphrase is configured (local dev), GET
   reports required:false and this never renders. */

type GateStatus = "checking" | "open" | "locked";

export default function AccessGate() {
  const [status, setStatus] = useState<GateStatus>("checking");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // check gate status on mount — setState lands in a promise callback
  // (the effect body itself never sets state synchronously)
  useEffect(() => {
    let alive = true;
    fetch("/api/rag/gate", { method: "GET" })
      .then(r => r.json())
      .then(json => { if (alive) setStatus(json.required && !json.unlocked ? "locked" : "open"); })
      .catch(() => { if (alive) setStatus("open"); });   // check failed → don't trap the user
    return () => { alive = false; };
  }, []);

  // a 401 mid-session (cookie expired) re-locks the lab
  useEffect(() => {
    const onLocked = () => setStatus("locked");
    window.addEventListener("rag:locked", onLocked);
    return () => window.removeEventListener("rag:locked", onLocked);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rag/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        setCode("");
        setStatus("open");
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json?.error ?? "Incorrect passphrase.");
      }
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {status === "locked" && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          data-access-gate
          style={{
            position: "fixed", inset: 0, zIndex: 140, display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16,
            background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)",
          }}
        >
          <motion.div
            role="dialog" aria-label="Enter lab passphrase"
            initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: "100%", maxWidth: 440, background: T.panel,
              border: `1px solid ${T.borderStrong}`, borderRadius: 18,
              padding: "26px 28px", boxShadow: DEPTH.overlay,
            }}
          >
            <p style={{ ...eyebrow, color: T.violet, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
              <Lock size={13} /> private lab
            </p>
            <h2 style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 22, letterSpacing: "-0.02em", color: T.fg, marginBottom: 8 }}>
              enter the passphrase
            </h2>
            <p style={{ fontSize: 13.5, color: T.fgSec, lineHeight: 1.6, marginBottom: 18 }}>
              This interactive lab makes live AI calls, so access is limited.
              Enter the passphrase you were given to unlock it.
            </p>

            <form onSubmit={submit}>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <KeyRound size={15} color={T.fgMuted} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="password"
                  value={code}
                  onChange={e => { setCode(e.target.value); setError(null); }}
                  autoFocus
                  aria-label="Passphrase"
                  aria-invalid={!!error}
                  placeholder="passphrase"
                  style={{
                    width: "100%", padding: "12px 14px 12px 38px", borderRadius: 11, outline: "none",
                    background: T.inset, border: `1px solid ${error ? T.red : T.border}`,
                    fontFamily: T.mono, fontSize: 14, color: T.fg,
                  }}
                />
              </div>
              {error && (
                <p role="alert" style={{ fontFamily: T.mono, fontSize: 12, color: T.red, marginBottom: 12 }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={!code.trim() || submitting}
                style={{
                  width: "100%", padding: "12px 18px", borderRadius: 11,
                  cursor: code.trim() && !submitting ? "pointer" : "default",
                  background: code.trim() && !submitting ? T.grad : T.inset,
                  border: code.trim() && !submitting ? "none" : `1px solid ${T.border}`,
                  fontFamily: T.disp, fontWeight: 700, fontSize: 14.5,
                  color: code.trim() && !submitting ? "#fff" : T.fgMuted,
                }}
              >
                {submitting ? "unlocking…" : "unlock the lab"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
