"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserRound, ChevronDown, GraduationCap, Wrench, Microscope, Briefcase, Presentation } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRagStore } from "../ragStore";
import { PERSONAS, PERSONA_IDS, type PersonaId } from "./personas";
import { T, DEPTH, eyebrow } from "../theme";

const ICONS: Record<PersonaId, LucideIcon> = {
  student: GraduationCap, engineer: Wrench, researcher: Microscope,
  executive: Briefcase, presenter: Presentation,
};

/* ── header switcher — persona changeable at any moment ───────── */

export function PersonaSwitch() {
  const persona = useRagStore(s => s.persona);
  const setPersona = useRagStore(s => s.setPersona);
  const journeyOverride = useRagStore(s => s.journeyOverride);
  const setJourneyOverride = useRagStore(s => s.setJourneyOverride);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const Icon = ICONS[persona];
  const journeyOn = journeyOverride !== null ? journeyOverride === "on" : PERSONAS[persona].journeyEnabled;
  const toggleJourney = () => setJourneyOverride(journeyOn ? "off" : "on");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`Viewing as ${PERSONAS[persona].label} — change persona`}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "11px 16px",
          borderRadius: 11, cursor: "pointer", whiteSpace: "nowrap",
          background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.4)",
          fontFamily: T.mono, fontSize: 12.5, fontWeight: 600, color: T.violet,
        }}
      >
        <Icon size={14} /> {PERSONAS[persona].label.toLowerCase()} <ChevronDown size={13} style={{ opacity: 0.7 }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
            style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 85, width: 300,
              background: T.panel, border: `1px solid ${T.borderStrong}`, borderRadius: 14,
              padding: 8, boxShadow: DEPTH.floating,
            }}
          >
            {PERSONA_IDS.map(id => {
              const p = PERSONAS[id];
              const PIcon = ICONS[id];
              const active = id === persona;
              return (
                <button
                  key={id}
                  onClick={() => { setPersona(id); setOpen(false); }}
                  style={{
                    display: "flex", gap: 10, width: "100%", textAlign: "left",
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: active ? "rgba(124,58,237,0.07)" : "transparent",
                    border: active ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
                  }}
                >
                  <PIcon size={16} color={active ? T.violet : T.fgSec} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    <span style={{ display: "block", fontFamily: T.disp, fontWeight: 700, fontSize: 13.5, color: T.fg }}>
                      {p.label}
                    </span>
                    <span style={{ display: "block", fontSize: 11.5, color: T.fgMuted, lineHeight: 1.5, marginTop: 2 }}>
                      {p.tagline}
                    </span>
                  </span>
                </button>
              );
            })}

            {/* the journey is a preference, not a persona — toggleable for anyone */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginTop: 6, padding: "10px 12px 6px", borderTop: `1px solid ${T.border}`,
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.fgSec, fontWeight: 600 }}>
                guided journey
              </span>
              <div
                role="switch" aria-checked={journeyOn} aria-label="Guided journey" tabIndex={0}
                onClick={toggleJourney}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleJourney(); } }}
                style={{
                  width: 34, height: 19, borderRadius: 10, cursor: "pointer", position: "relative",
                  background: journeyOn ? "rgba(5,150,105,0.8)" : "rgba(148,163,184,0.45)",
                  transition: "background 0.15s",
                }}
              >
                <span style={{
                  position: "absolute", top: 2.5, left: journeyOn ? 17 : 2.5,
                  width: 14, height: 14, borderRadius: "50%", background: "#fff",
                  transition: "left 0.15s", boxShadow: "0 1px 3px rgba(15,23,42,0.3)",
                }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── first-visit welcome — pick a lens, or skip into student ──── */

export function PersonaWelcome() {
  const hydrated = useRagStore(s => s.uiHydrated);
  const chosen = useRagStore(s => s.personaChosen);
  const setPersona = useRagStore(s => s.setPersona);

  return (
    <AnimatePresence>
      {hydrated && !chosen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 88, display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16,
            background: "rgba(15,23,42,0.38)", backdropFilter: "blur(4px)",
          }}
        >
          <motion.div
            role="dialog" aria-label="Choose how to explore"
            initial={{ y: 18, scale: 0.98 }} animate={{ y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: "100%", maxWidth: 620, maxHeight: "86vh", overflowY: "auto",
              background: T.panel, border: `1px solid ${T.borderStrong}`,
              borderRadius: 20, padding: "28px 28px 24px", boxShadow: DEPTH.overlay,
            }}
          >
            <p style={{ ...eyebrow, color: T.violet, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <UserRound size={13} /> welcome to the rag visualizer
            </p>
            <h2 style={{ fontFamily: T.disp, fontWeight: 900, fontSize: 26, letterSpacing: "-0.03em", color: T.fg, textTransform: "lowercase", marginBottom: 6 }}>
              who&apos;s exploring today?
            </h2>
            <p style={{ fontSize: 13.5, color: T.fgSec, lineHeight: 1.6, marginBottom: 18 }}>
              Same pipeline, five lenses — pick yours and the whole app adapts. You can switch anytime from the header.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 16 }}>
              {PERSONA_IDS.map(id => {
                const p = PERSONAS[id];
                const PIcon = ICONS[id];
                return (
                  <button
                    key={id}
                    onClick={() => setPersona(id)}
                    style={{
                      display: "flex", gap: 12, textAlign: "left", padding: "14px 15px",
                      borderRadius: 13, cursor: "pointer",
                      background: T.inset, border: `1px solid ${T.border}`,
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.55)"; e.currentTarget.style.background = "#FBFAFE"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.inset; }}
                  >
                    <PIcon size={18} color={T.violet} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      <span style={{ display: "block", fontFamily: T.disp, fontWeight: 700, fontSize: 14.5, color: T.fg }}>
                        {p.label}
                      </span>
                      <span style={{ display: "block", fontSize: 12, color: T.fgMuted, lineHeight: 1.55, marginTop: 3 }}>
                        {p.tagline}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPersona("student")}
              style={{
                all: "unset", cursor: "pointer", fontFamily: T.mono, fontSize: 12,
                color: T.fgMuted, borderBottom: `1px dotted ${T.fgMuted}`,
              }}
            >
              just exploring — start me as a student →
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
