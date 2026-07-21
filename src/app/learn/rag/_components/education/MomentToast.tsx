"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, X } from "lucide-react";
import { useRagStore } from "../ragStore";
import { T, DEPTH, eyebrow } from "../theme";

/** One ambient micro-lesson at a time — never modal, never nagging. */
export default function MomentToast({ isMobile }: { isMobile: boolean }) {
  const moment = useRagStore(s => s.activeMoment);
  const dismiss = useRagStore(s => s.dismissMoment);
  const clear = useRagStore(s => s.clearMoment);

  return (
    <AnimatePresence>
      {moment && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed", right: isMobile ? 10 : 24,
            bottom: isMobile ? 92 : 24, zIndex: 75,
            width: isMobile ? "calc(100vw - 20px)" : 380,
            background: T.panel, border: "1px solid rgba(217,119,6,0.4)",
            borderRadius: 14, padding: "14px 16px",
            boxShadow: `${DEPTH.floating}, ${DEPTH.innerHighlight}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ ...eyebrow, fontSize: 10.5, color: T.amber, display: "flex", alignItems: "center", gap: 6 }}>
              <Lightbulb size={13} /> learning moment
            </p>
            <button onClick={clear} aria-label="Hide learning moment"
              style={{ all: "unset", cursor: "pointer", color: T.fgMuted, display: "flex" }}>
              <X size={14} />
            </button>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: T.fgSec, marginBottom: 10 }}>
            {moment.text}
          </p>
          <button
            onClick={dismiss}
            style={{
              padding: "6px 14px", borderRadius: 9, cursor: "pointer",
              background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.4)",
              fontFamily: T.mono, fontSize: 11.5, color: T.amber, fontWeight: 600,
            }}
          >
            got it — don&apos;t show this one again
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
