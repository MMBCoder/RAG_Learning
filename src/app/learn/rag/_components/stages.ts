import type { StageId } from "./ragStore";

export interface StageDef {
  id: StageId;
  title: string;
  group: "ingestion" | "query";
  icon: string;              // lucide icon name resolved in PipelineCanvas
  blurb: string;             // one line under the node title
  explanation: string;       // inspector "what is this stage"
  inputDesc: string;
  outputDesc: string;
  narration: string;         // play-mode narration
}

export const STAGES: StageDef[] = [
  {
    id: "upload", title: "Document Upload", group: "ingestion", icon: "FileUp",
    blurb: "PDF in, max 5 MB",
    explanation: "Everything in RAG starts with a source document. The file is read in the browser — nothing is stored on a server — and handed to the parser as raw bytes.",
    inputDesc: "A PDF file (≤ 5 MB) or the built-in sample product guide.",
    outputDesc: "Raw document bytes plus file metadata (name, size, page count).",
    narration: "It all starts with a document. We load a PDF — here, a credit card product guide — and hand its raw bytes to the pipeline. Nothing leaves your browser except the text we explicitly embed.",
  },
  {
    id: "parse", title: "Parsing", group: "ingestion", icon: "ScanText",
    blurb: "PDF → pages → text",
    explanation: "PDF.js walks the document structure and extracts the text layer page by page. Layout artifacts — columns, headers, broken lines — are preserved at this stage; cleaning comes next.",
    inputDesc: "Raw PDF bytes.",
    outputDesc: "An ordered list of pages, each with its extracted text and character count.",
    narration: "The parser opens the PDF and extracts the text layer page by page. A PDF is a drawing format, not a text format — so this step reconstructs readable text from positioned glyphs.",
  },
  {
    id: "clean", title: "Cleaning", group: "ingestion", icon: "Eraser",
    blurb: "normalise & de-noise",
    explanation: "Raw extracted text is noisy: hyphenated line breaks, repeated whitespace, control characters. Cleaning normalises it so chunk boundaries and embeddings aren't polluted by layout artifacts.",
    inputDesc: "Raw page text with layout noise.",
    outputDesc: "Normalised text per page, with a report of what was fixed.",
    narration: "Extracted text is messy — words broken across lines, stray whitespace, control characters. Cleaning normalises all of it, because every artifact that survives here ends up inside an embedding.",
  },
  {
    id: "chunk", title: "Chunking", group: "ingestion", icon: "Scissors",
    blurb: "split with overlap",
    explanation: "The document is split into overlapping chunks along sentence boundaries. Chunk size trades precision against context: small chunks retrieve precisely but lose surrounding meaning; large chunks keep context but dilute similarity scores. Overlap prevents facts from being cut in half at a boundary.",
    inputDesc: "Cleaned full-document text.",
    outputDesc: "Ordered chunks with position, page, character and token counts, and overlap.",
    narration: "Now the document is split into overlapping chunks along sentence boundaries. This is the single most important tuning decision in RAG — chunk size controls the trade-off between retrieval precision and context. Try changing it in the parameters panel.",
  },
  {
    id: "tokenize", title: "Tokenization", group: "ingestion", icon: "Binary",
    blurb: "text → tokens",
    explanation: "Models don't read characters — they read tokens, sub-word units from a fixed vocabulary. Token counts (estimated here with a cl100k-style heuristic) drive both cost and context-window budgeting.",
    inputDesc: "Chunk text.",
    outputDesc: "Token estimates per chunk and a token-level view of any chunk.",
    narration: "Language models don't read words — they read tokens, sub-word pieces from a fixed vocabulary. Watch a chunk break apart into tokens. Every token has a price, and every context window is a token budget.",
  },
  {
    id: "embed", title: "Embeddings", group: "ingestion", icon: "Network",
    blurb: "768-dim vectors",
    explanation: "Each chunk is sent to Google gemini-embedding-001 and comes back as a 768-dimensional vector. Chunks that mean similar things land near each other in this space — that geometry is what makes semantic search possible. The 3D view is a PCA projection of the real vectors.",
    inputDesc: "Chunk texts (batched API call).",
    outputDesc: "One 768-dimensional vector per chunk.",
    narration: "Each chunk is converted into a 768-dimensional vector by the embedding model. Meaning becomes geometry: chunks about fees cluster together, chunks about lounge access cluster somewhere else. The 3D view is a projection of the real vectors — drag it.",
  },
  {
    id: "index", title: "Vector Index", group: "ingestion", icon: "Database",
    blurb: "vectors + metadata",
    explanation: "Vectors are inserted into an index alongside their metadata — chunk id, page, token count. In production this is ChromaDB, Qdrant or pgvector; here it's an in-memory index with the same interface: nearest-neighbour search over cosine similarity.",
    inputDesc: "Embedding vectors + chunk metadata.",
    outputDesc: "A searchable vector index. The document is now 'ingested'.",
    narration: "The vectors are inserted into a vector index together with their metadata — page numbers, token counts, positions. The document is now fully ingested. From here on, everything is about answering questions.",
  },
  {
    id: "query", title: "User Query", group: "query", icon: "MessageCircleQuestion",
    blurb: "question → vector",
    explanation: "The user's question is embedded with the same model as the chunks — that's what makes them comparable. The query becomes a point in the same 768-dimensional space, and retrieval is simply 'what's nearby?'.",
    inputDesc: "The user's natural-language question.",
    outputDesc: "A query vector in the same space as the chunk vectors.",
    narration: "A question arrives. It's embedded with the same model as the document, so it lands as a point in the same semantic space. Answering the question is now a geometry problem: what's near this point?",
  },
  {
    id: "retrieve", title: "Hybrid Retrieval", group: "query", icon: "Radar",
    blurb: "semantic + keyword",
    explanation: "Every chunk is scored two ways: cosine similarity against the query vector (semantic) and a BM25-style keyword score (lexical). The hybrid score blends them with weight α. Semantic search catches paraphrases; keyword search catches exact terms like product names — hybrid gets both.",
    inputDesc: "Query vector + query terms, run against the whole index.",
    outputDesc: "Every chunk scored and ranked; top-K above the threshold survive.",
    narration: "The retriever scores every chunk twice — semantically, by cosine similarity in vector space, and lexically, with keyword matching. The hybrid score blends both. Semantic catches paraphrases; keyword catches exact product names. Watch the scores race.",
  },
  {
    id: "rerank", title: "Re-ranking", group: "query", icon: "ArrowDownWideNarrow",
    blurb: "LLM re-orders top-K",
    explanation: "First-pass retrieval is fast but shallow. A re-ranker reads the actual text of the top candidates against the question and re-orders them by true relevance. Here GPT-5 mini scores each candidate 0–100; in production this is often a dedicated cross-encoder.",
    inputDesc: "Top candidate chunks + the question.",
    outputDesc: "Candidates re-ordered by LLM relevance score.",
    narration: "Fast retrieval is approximate, so a re-ranker takes a second look: it reads the actual text of each candidate against the question and re-scores it. Watch the ranking shuffle — the chunks that merely look similar drop, the ones that truly answer rise.",
  },
  {
    id: "prompt", title: "Prompt Builder", group: "query", icon: "Blocks",
    blurb: "system + context + Q",
    explanation: "The final prompt is assembled from three blocks: the system prompt (rules and citation format), the retrieved chunks (numbered so the model can cite them), and the user's question. The context-window gauge shows how much of the token budget each block consumes.",
    inputDesc: "System prompt template, surviving chunks, user question.",
    outputDesc: "The exact prompt string sent to the model, with per-block token counts.",
    narration: "Now the prompt is assembled like a legal brief: the system prompt sets the rules — answer only from context, cite every claim. The retrieved chunks are numbered evidence. The question comes last. Every block spends tokens from a fixed budget.",
  },
  {
    id: "generate", title: "GPT-5 mini", group: "query", icon: "Sparkles",
    blurb: "grounded generation",
    explanation: "The assembled prompt goes to GPT-5 mini. Because the model is instructed to answer only from the supplied context and cite chunk numbers, the output is grounded — every claim traceable to a source passage.",
    inputDesc: "The assembled prompt.",
    outputDesc: "The model's answer with [n] citations, plus token usage and latency.",
    narration: "The prompt goes to GPT-5 mini. The model is under strict instructions: answer only from the evidence, cite every claim. This is the moment retrieval-augmented generation earns its name — generation, constrained by retrieval.",
  },
  {
    id: "ground", title: "Grounding", group: "query", icon: "Link2",
    blurb: "answer ↔ source",
    explanation: "Each sentence of the answer is mapped back to the chunks it cites. Hover any sentence to light up the exact source passage — and the page it came from. This traceability is the difference between RAG and a model 'just answering'.",
    inputDesc: "The answer text with [n] citation markers.",
    outputDesc: "Sentence → source-chunk mapping for interactive verification.",
    narration: "Every sentence of the answer is now wired back to its source. Hover a sentence and the exact passage lights up. This traceability — claim to evidence — is what separates a grounded answer from a confident guess.",
  },
  {
    id: "evaluate", title: "Evaluation", group: "query", icon: "Gauge",
    blurb: "faithfulness & risk",
    explanation: "An LLM judge scores the exchange: faithfulness (is every claim supported by the context?), answer relevance, context precision and recall, and overall hallucination risk. In production these metrics run continuously to catch regressions when parameters change.",
    inputDesc: "Question + retrieved context + generated answer.",
    outputDesc: "Five quality scores and a verdict.",
    narration: "Finally, an independent judge scores the whole exchange — was every claim supported by the evidence? Was the retrieved context actually used? What's the hallucination risk? In production, these metrics run on every answer. That's the full pipeline — now open any node and start tuning.",
  },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map(s => [s.id, s])) as Record<StageId, StageDef>;
export const INGESTION_STAGES = STAGES.filter(s => s.group === "ingestion");
export const QUERY_STAGES = STAGES.filter(s => s.group === "query");
