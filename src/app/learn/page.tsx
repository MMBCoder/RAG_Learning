import Link from "next/link";

export default function LearnPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: 16 }}>
          RAG Pipeline Visualizer
        </h1>
        <p style={{ color: "#9aa0a6", lineHeight: 1.7, marginBottom: 28 }}>
          Watch a document become a grounded answer — every stage of a production Retrieval-Augmented
          Generation pipeline, live, inspectable, and tunable.
        </p>
        <Link
          href="/learn/rag"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px",
            background: "#2563EB", color: "#fff", borderRadius: 8, textDecoration: "none",
            fontFamily: "var(--font-space-grotesk), sans-serif", fontWeight: 700,
          }}
        >
          Open the visualizer →
        </Link>
      </div>
    </main>
  );
}
