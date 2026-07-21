import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RAG Pipeline Visualizer — Mirza Minhaz Baig",
  description:
    "An interactive lab that visualizes every stage of a production Retrieval-Augmented Generation pipeline — parsing, chunking, embeddings, hybrid retrieval, re-ranking, grounded generation and evaluation.",
};

export default function RagLayout({ children }: { children: React.ReactNode }) {
  return children;
}
