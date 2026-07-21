import type { RagParams, StageId } from "../store/types";

/* ═══════════════════════════════════════════════════════════════════
   THE CONCEPT REGISTRY — the single educational knowledge base.
   Every tooltip, narration beat, coach insight, and lab explanation
   quotes these entries, so the learner hears one consistent voice.

   Coverage is CI-enforced (concepts.test.ts): every pipeline stage and
   every tunable parameter must map to an entry, and every cross-
   reference (related / params / experiments) must resolve.
   ═══════════════════════════════════════════════════════════════════ */

/** AI Lab presets (implemented in M12; referenced as suggestions now). */
export type ExperimentId =
  | "no-overlap" | "giant-chunks" | "tiny-chunks" | "top-k-1" | "top-k-8"
  | "rerank-off" | "keyword-only" | "semantic-only" | "starved-context";

export const EXPERIMENT_LABELS: Record<ExperimentId, string> = {
  "no-overlap": "Remove all chunk overlap",
  "giant-chunks": "Giant chunks (1,600 chars)",
  "tiny-chunks": "Tiny chunks (200 chars)",
  "top-k-1": "Retrieve only 1 chunk",
  "top-k-8": "Retrieve 8 chunks",
  "rerank-off": "Disable re-ranking",
  "keyword-only": "Keyword-only search",
  "semantic-only": "Semantic-only search",
  "starved-context": "Starve the context window",
};

export type ConceptId =
  | "document-ingestion" | "pdf-parsing" | "text-cleaning" | "chunking"
  | "chunk-overlap" | "tokenization" | "embeddings" | "cosine-similarity"
  | "vector-index" | "query-embedding" | "semantic-search" | "keyword-search"
  | "hybrid-search" | "similarity-threshold" | "top-k" | "reranking"
  | "prompt-construction" | "system-prompt" | "context-window" | "generation"
  | "temperature" | "max-tokens" | "grounding" | "citations" | "evaluation"
  | "faithfulness" | "answer-relevance" | "context-precision" | "context-recall"
  | "hallucination" | "embedding-projection" | "cost-economics" | "latency";

/** How settled this practice is in the field — rendered as a badge so
    learners can tell textbook knowledge from active research. */
export type ConfidenceLevel = "established" | "evolving" | "debated";

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  established: "established practice",
  evolving: "evolving practice",
  debated: "actively debated",
};

/** Stable visual identity for a concept — the same glyph + accent hue
    wherever it appears (cards, badges; Universe/Brain from M7/M10).
    Glyph is a single unicode character so it renders in DOM, SVG, and
    canvas alike. */
export interface ConceptVisual {
  glyph: string;
  hue: string;   // #rrggbb
}

export interface Concept {
  id: ConceptId;
  term: string;
  /** Technical definition — precise, one to two sentences. */
  technical: string;
  /** Plain-English explanation — no jargon. */
  plain: string;
  /** Real-world analogy. */
  analogy: string;
  /** Why this exists in a RAG pipeline. */
  why: string;
  /** What happens if it is configured incorrectly. */
  misconfigured: string;
  /** How it affects retrieval quality. */
  retrievalImpact: string;
  /** How it affects hallucination risk. */
  hallucinationImpact: string;
  /** Parameters that influence it (must be real RagParams keys). */
  params: (keyof RagParams)[];
  /** Related concepts (must be real ConceptIds). */
  related: ConceptId[];
  /** Suggested AI Lab experiments. */
  experiments: ExperimentId[];

  /* ── optional enrichment (schema approved post-M1) — populated
        progressively; consumers must treat absence as normal ── */
  /** Confidence level: how settled this knowledge is in the field. */
  confidence?: ConfidenceLevel;
  /** Historical context — where the technique came from. */
  history?: string;
  /** Visual identity — reserved consumers arrive in M7 (Universe) / M10 (Brain). */
  visual?: ConceptVisual;
  /** A concrete experiment runnable RIGHT NOW with existing controls
      (unlike `experiments`, which reference AI Lab presets from M12). */
  tryThis?: string;
}

export const CONCEPTS: Record<ConceptId, Concept> = {
  "document-ingestion": {
    id: "document-ingestion",
    term: "Document ingestion",
    technical: "Validation and byte-level intake of a source file (here: PDF ≤ 5 MB) before any text extraction begins.",
    plain: "The pipeline accepts your document and checks it's something it can actually work with.",
    analogy: "A museum's loading dock: crates are checked, weighed, and logged before anything goes on display.",
    why: "Everything downstream assumes a valid, readable document — catching a scanned image or oversized file here fails fast instead of failing weirdly later.",
    misconfigured: "Accepting anything blindly means cryptic failures later: a scanned PDF yields zero text and an empty index that can never answer questions.",
    retrievalImpact: "Indirect but total: a bad ingest means there is nothing correct to retrieve.",
    hallucinationImpact: "An empty or garbled corpus invites the model to answer from its own memory instead of your document — the classic hallucination setup.",
    params: [],
    related: ["pdf-parsing", "text-cleaning"],
    experiments: [],
  },
  "pdf-parsing": {
    id: "pdf-parsing",
    term: "PDF parsing",
    technical: "Extraction of the text layer from the PDF's internal structure, page by page, preserving page numbers for provenance.",
    plain: "The PDF's visible words are pulled out into plain text the pipeline can process, page by page.",
    analogy: "Transcribing a printed book into a text file — keeping a note of which page every paragraph came from.",
    why: "Models can't read PDFs; they read text. Page numbers are kept so every answer can be traced back to a physical place in the document.",
    misconfigured: "Parsing a scanned (image-only) PDF produces no text; parsing without page tracking destroys provenance — citations could never point back to a page.",
    retrievalImpact: "Extraction quality bounds everything: text the parser misses can never be found by any search, no matter how good.",
    hallucinationImpact: "Missing or mangled text creates gaps the model may 'helpfully' fill with invented content.",
    params: [],
    related: ["document-ingestion", "text-cleaning"],
    experiments: [],
  },
  "text-cleaning": {
    id: "text-cleaning",
    term: "Text cleaning",
    technical: "Normalisation of extracted text: rejoining hyphenated line breaks, merging mid-sentence newlines, stripping control characters, collapsing whitespace.",
    plain: "PDF text comes out messy — words split across lines, stray symbols. Cleaning stitches it back into natural sentences.",
    analogy: "Ironing a crumpled letter flat before photocopying it — same words, but now every copy is legible.",
    why: "Embeddings and chunking work on sentences. 'informa- tion' embeds differently from 'information'; broken text means broken meaning.",
    misconfigured: "Over-cleaning can merge separate paragraphs into run-ons; under-cleaning leaves split words that embed as gibberish and never match a query.",
    retrievalImpact: "Clean text embeds accurately, so semantically similar passages actually land near each other in vector space.",
    hallucinationImpact: "Garbled context confuses the model — it may paraphrase noise into confident-sounding fabrications.",
    params: [],
    related: ["pdf-parsing", "chunking", "embeddings"],
    experiments: [],
  },
  "chunking": {
    id: "chunking",
    term: "Chunking",
    technical: "Splitting the document into retrieval units of a target character size along sentence boundaries; each chunk is embedded and retrieved independently.",
    plain: "The document is cut into bite-sized passages. Search happens at the passage level — the model never sees the whole document, only the best passages.",
    analogy: "Cutting a textbook into index cards: you can hand someone the three most relevant cards instead of the whole book.",
    why: "Embedding a whole document into one vector blurs all its topics together; small units let retrieval pinpoint exactly the relevant passage — and they fit in the context window.",
    misconfigured: "Too large: each chunk mixes topics, similarity scores blur, and a few chunks flood the context budget. Too small: facts get split mid-thought and no single chunk contains a complete answer.",
    retrievalImpact: "The single biggest retrieval lever — chunk size sets the resolution at which meaning can be found.",
    hallucinationImpact: "Chunks that cut a fact in half force the model to guess the missing half — a direct hallucination source.",
    params: ["chunkSize"],
    related: ["chunk-overlap", "embeddings", "context-window", "top-k"],
    experiments: ["giant-chunks", "tiny-chunks"],
    confidence: "evolving",
    visual: { glyph: "▦", hue: "#2563EB" },
    tryThis: "Set chunk size to its minimum, re-ingest, and ask something that needs a full paragraph — then push it to the maximum and watch each chunk start mixing topics.",
  },
  "chunk-overlap": {
    id: "chunk-overlap",
    term: "Chunk overlap",
    technical: "A configurable number of characters repeated from the tail of one chunk at the head of the next, carried back along sentence boundaries.",
    plain: "Neighbouring chunks share a little text at their edges, so a sentence that straddles a boundary exists whole in at least one chunk.",
    analogy: "Overlapping roof shingles: the overlap is 'wasted' material, but it's exactly what stops leaks at the seams.",
    why: "Chunk boundaries are arbitrary; ideas aren't. Overlap insures against a key fact being sliced in half at a boundary.",
    misconfigured: "Zero overlap risks split facts at every boundary. Excessive overlap stores the same text many times — inflating embedding cost and letting near-duplicate chunks crowd out diverse results in top-K.",
    retrievalImpact: "Modest overlap raises the chance that the complete answer lives inside a single retrievable chunk.",
    hallucinationImpact: "Split facts are half-answers, and half-answers get completed by imagination. Overlap directly reduces that failure mode.",
    params: ["chunkOverlap", "chunkSize"],
    related: ["chunking", "top-k"],
    experiments: ["no-overlap"],
    tryThis: "Set overlap to 0, re-ingest, and ask about a fact that sits near a chunk boundary — then restore the overlap and watch the same fact arrive intact.",
  },
  "tokenization": {
    id: "tokenization",
    term: "Tokenization",
    technical: "Conversion of text into the sub-word units (tokens) a model actually processes; this app displays a cl100k-style estimate (≈0.45·words + chars/4·0.55).",
    plain: "Models don't read words — they read tokens, sub-word pieces like 'token' + 'ization'. Every cost and every limit in this pipeline is measured in tokens.",
    analogy: "A currency exchange: before your text enters the model's economy, it's converted into the only currency the model accepts.",
    why: "Context windows, API pricing, and output limits are all denominated in tokens — you can't budget what you can't count.",
    misconfigured: "Underestimating token counts silently overflows the context budget, truncating the most important chunk; overestimating wastes context space you paid for.",
    retrievalImpact: "Token counts decide how many retrieved chunks physically fit in the prompt — miscounting evicts evidence.",
    hallucinationImpact: "Evidence that gets truncated out of the prompt is evidence the model replaces with guesswork.",
    params: ["contextBudget", "maxTokens"],
    related: ["context-window", "cost-economics", "max-tokens"],
    experiments: ["starved-context"],
    confidence: "established",
    history: "Byte-pair encoding began life as a 1994 data-compression trick; machine-translation researchers repurposed it in 2016 to handle unlimited vocabularies, and today virtually every LLM reads text through a BPE-style tokenizer.",
  },
  "embeddings": {
    id: "embeddings",
    term: "Embeddings",
    technical: "Dense vector representations (here: gemini-embedding-001, 768 dimensions) where semantic similarity of texts corresponds to proximity of their vectors.",
    plain: "Each chunk is converted into a long list of numbers that captures its meaning. Similar meanings become nearby points — so 'find similar text' becomes 'find nearby points'.",
    analogy: "A map of ideas: every passage gets GPS coordinates, and passages about the same thing become neighbours — 'refund policy' and 'money-back guarantee' end up on the same street.",
    why: "Keyword search can't tell that 'annual fee' answers 'how much does it cost per year'. Embeddings match by meaning, not spelling.",
    misconfigured: "Embedding dirty or oversized text produces mushy vectors; mixing embeddings from different models makes distances meaningless — every query would retrieve noise.",
    retrievalImpact: "Embedding quality IS semantic retrieval quality — the geometry either reflects meaning or it doesn't.",
    hallucinationImpact: "Bad geometry retrieves irrelevant chunks; the model then answers around them or ignores them and improvises.",
    params: ["chunkSize"],
    related: ["cosine-similarity", "vector-index", "semantic-search", "embedding-projection"],
    experiments: ["semantic-only"],
    confidence: "established",
    history: "Word vectors existed in 1990s research, but word2vec (2013) made 'meaning as geometry' cheap and practical, and transformer sentence embeddings (2018 onward) extended it from single words to whole passages — the step that made modern RAG possible.",
    visual: { glyph: "◈", hue: "#7C3AED" },
    tryThis: "Open the embed stage after ingesting and find two chunks about the same topic — their similarity score will beat chunks that merely share common words.",
  },
  "cosine-similarity": {
    id: "cosine-similarity",
    term: "Cosine similarity",
    technical: "The cosine of the angle between two vectors: 1 = same direction (same meaning), 0 = orthogonal (unrelated). The core distance measure of semantic search.",
    plain: "A number between roughly 0 and 1 saying how close in meaning two pieces of text are — 1 is 'basically the same idea', near 0 is 'nothing to do with each other'.",
    analogy: "Two compass needles: pointing the same way = same topic; at right angles = unrelated topics. We measure the angle, not the distance walked.",
    why: "Retrieval needs a single, fast, comparable score for 'how relevant is this chunk to this question' — the angle between their embedding vectors is that score.",
    misconfigured: "Treating raw cosine scores as absolute truth is the mistake — a 0.4 can be the best available match or a terrible one depending on the corpus, which is why thresholds need tuning per document.",
    retrievalImpact: "It literally is the ranking function of the semantic half of retrieval.",
    hallucinationImpact: "Accepting low-similarity chunks as evidence hands the model weak context — answers drift from the document.",
    params: ["threshold", "hybridAlpha"],
    related: ["embeddings", "semantic-search", "similarity-threshold"],
    experiments: ["semantic-only"],
    confidence: "established",
    history: "Inherited directly from the vector space model of 1970s information retrieval (Gerard Salton's SMART system) — embeddings changed what the vectors mean, not how they are compared.",
  },
  "vector-index": {
    id: "vector-index",
    term: "Vector index",
    technical: "The searchable store of all chunk embeddings. Production systems use ANN structures (HNSW, IVF); this app scans in memory — same behaviour, smaller scale.",
    plain: "All the chunk vectors live here, organised so that 'find the nearest vectors to this question' is a single fast lookup.",
    analogy: "A library's catalogue — but organised by what books mean rather than by title, so you can ask for 'books like this one'.",
    why: "Without an index you'd re-embed and re-compare the whole document for every question. Index once, query thousands of times.",
    misconfigured: "A stale index — chunks changed but vectors not rebuilt — silently searches the OLD document. This app marks everything downstream 'stale' to prevent exactly that.",
    retrievalImpact: "The index defines what is findable; anything not (re-)indexed effectively doesn't exist.",
    hallucinationImpact: "Stale vectors retrieve outdated text, and the model grounds its answer on a document that no longer exists.",
    params: [],
    related: ["embeddings", "semantic-search"],
    experiments: [],
  },
  "query-embedding": {
    id: "query-embedding",
    term: "Query embedding",
    technical: "The user's question is embedded with the SAME model as the chunks, projecting question and document into one shared vector space.",
    plain: "Your question gets converted into the same kind of number-list as the chunks — now 'which chunks answer this?' becomes 'which points are nearest?'.",
    analogy: "Translating your question into the same language as the catalogue before searching it — comparisons only work in a shared language.",
    why: "Similarity is only meaningful between vectors from the same model; the question must enter the same map the chunks live on.",
    misconfigured: "Embedding queries with a different model than the chunks makes every distance meaningless — retrieval degrades to random.",
    retrievalImpact: "The query vector is the search probe — its quality decides which neighbourhood of the document gets explored.",
    hallucinationImpact: "A poorly-placed probe retrieves the wrong neighbourhood, and the model answers from irrelevant evidence.",
    params: [],
    related: ["embeddings", "semantic-search", "cosine-similarity"],
    experiments: [],
  },
  "semantic-search": {
    id: "semantic-search",
    term: "Semantic search",
    technical: "Ranking chunks by cosine similarity between the query embedding and each chunk embedding — matching by meaning rather than shared words.",
    plain: "Finds passages that mean the same as your question, even when they use completely different words.",
    analogy: "A librarian who understands what you're asking about, versus one who only checks if book titles contain your exact words.",
    why: "People rarely phrase questions with the document's vocabulary. Semantic search bridges 'what does it cost yearly?' to 'annual fee: $95'.",
    misconfigured: "Pure semantic search misses exact identifiers — product codes, names, numbers — where spelling IS the meaning. That's why hybrid search exists.",
    retrievalImpact: "Provides the meaning-matching half of retrieval; strongest on paraphrased or conceptual questions.",
    hallucinationImpact: "Good semantic recall supplies real evidence, shrinking the gaps the model would otherwise fill by invention.",
    params: ["hybridAlpha"],
    related: ["keyword-search", "hybrid-search", "embeddings", "cosine-similarity"],
    experiments: ["semantic-only", "keyword-only"],
  },
  "keyword-search": {
    id: "keyword-search",
    term: "Keyword search (BM25)",
    technical: "Lexical ranking (BM25-style: term frequency × inverse document frequency, length-normalised) rewarding chunks that contain the query's rare words.",
    plain: "Old-fashioned exact-word matching — which passages literally contain the words you typed, weighted so rare words count more than common ones.",
    analogy: "Ctrl+F with judgement: finding 'Voyager' matters more than finding 'the', and a short paragraph full of your words beats a long one that mentions them once.",
    why: "Embeddings blur exact identifiers; BM25 nails them. 'Error VX-221' should match the chunk containing VX-221, not chunks about errors in general.",
    misconfigured: "Pure keyword search fails on paraphrases ('cost per year' ≠ 'annual fee') and is blind to meaning — synonyms score zero.",
    retrievalImpact: "Provides the precision half of retrieval; strongest on names, codes, and rare terms.",
    hallucinationImpact: "Missing an exact-match chunk (the one that actually contains the fact) forces the model to approximate — keyword search is the safety net for literal facts.",
    params: ["hybridAlpha"],
    related: ["semantic-search", "hybrid-search"],
    experiments: ["keyword-only", "semantic-only"],
    confidence: "established",
    history: "Term-frequency weighting goes back to Karen Spärck Jones's 1972 work on term specificity; BM25 (1994) refined it and remains the lexical baseline that every neural search method is still measured against.",
  },
  "hybrid-search": {
    id: "hybrid-search",
    term: "Hybrid search",
    technical: "A weighted blend of normalised semantic and keyword scores: hybrid = α·semantic + (1−α)·keyword. α=1 is pure meaning, α=0 pure words.",
    plain: "Both search styles run, and their scores are mixed with an adjustable balance — meaning-matching and word-matching cover each other's blind spots.",
    analogy: "Two experts scoring the same candidates — one judges understanding, one checks credentials — and you decide how much weight each vote gets.",
    why: "Neither search alone is reliable: semantic misses exact codes, keyword misses paraphrases. The blend is robust to both question styles.",
    misconfigured: "α too high: exact identifiers slip through. α too low: paraphrased questions retrieve nothing. The blend also breaks silently if scores aren't normalised before mixing.",
    retrievalImpact: "Directly sets the retrieval ranking — watch candidates reorder live as you drag α.",
    hallucinationImpact: "Better-balanced retrieval means the right evidence reaches the prompt more often, leaving less for the model to invent.",
    params: ["hybridAlpha", "threshold", "topK"],
    related: ["semantic-search", "keyword-search", "similarity-threshold", "top-k"],
    experiments: ["keyword-only", "semantic-only"],
    confidence: "evolving",
    tryThis: "Drag the hybrid blend α to 0, then to 1, with the same question — and watch the candidate ranking reorder live between word-matching and meaning-matching.",
  },
  "similarity-threshold": {
    id: "similarity-threshold",
    term: "Similarity threshold",
    technical: "The minimum hybrid score a chunk must reach to be considered at all — a quality floor applied before top-K selection.",
    plain: "A bouncer for evidence: chunks scoring below this line don't get in, no matter how few chunks are inside.",
    analogy: "A minimum grade to pass the exam — if nobody scores above it, nobody passes, and that's the point: bad evidence is worse than no evidence.",
    why: "Top-K alone always returns K chunks, even laughably irrelevant ones. The threshold lets retrieval say 'this document doesn't answer that'.",
    misconfigured: "Too high: legitimate evidence gets rejected and the model is starved (watch retrieval return 0 chunks). Too low: junk chunks pad the prompt and dilute the real evidence.",
    retrievalImpact: "Trades recall for precision — the classic retrieval dial.",
    hallucinationImpact: "Counter-intuitively, a WELL-SET threshold reduces hallucination: feeding the model weak evidence tempts it to overreach, while an honest 'nothing found' produces an honest 'I don't know'.",
    params: ["threshold"],
    related: ["top-k", "hybrid-search", "cosine-similarity"],
    experiments: ["top-k-1", "top-k-8"],
    tryThis: "Raise the threshold until retrieval returns zero chunks — the honest 'this document doesn't answer that' is a feature, not a failure. Then find the highest setting that still answers.",
  },
  "top-k": {
    id: "top-k",
    term: "Top-K",
    technical: "The number of highest-scoring chunks passed onward after thresholding (and re-ranking, if enabled) — the size of the evidence set.",
    plain: "How many of the best passages get sent to the model — the size of its briefing pack.",
    analogy: "How many index cards you hand the expert before their answer: one card risks missing context; forty cards and they can't find the relevant one.",
    why: "The model can't read the whole document. K controls the balance between enough evidence and focused evidence, and directly scales prompt cost.",
    misconfigured: "K=1 gambles everything on one chunk being complete. K too large floods the context: cost rises, the model's attention spreads thin, and weak chunks contradict strong ones.",
    retrievalImpact: "Sets the recall ceiling of the final evidence set — a fact outside the top K does not exist for the model.",
    hallucinationImpact: "Both extremes raise risk: too little evidence leaves gaps to fill; too much noise gives the model contradictions to 'resolve' creatively.",
    params: ["topK", "threshold"],
    related: ["similarity-threshold", "reranking", "context-window", "chunking"],
    experiments: ["top-k-1", "top-k-8"],
    tryThis: "Ask the same question at top-K = 1 and again at top-K = 8, then compare the answer's completeness against the context-precision score — the trade-off appears in one experiment.",
  },
  "reranking": {
    id: "reranking",
    term: "Re-ranking",
    technical: "A second-pass relevance scoring of the top candidates by a stronger model (here: an LLM scoring 0–100), reordering the fast first-pass ranking.",
    plain: "Fast search finds ~8 promising passages; then a smarter (slower, costlier) judge reads each one properly and reorders them before the best K are chosen.",
    analogy: "A CV screen followed by a real interview: the screen is fast but shallow — the interview catches the candidate whose CV undersold them.",
    why: "Vector similarity is an approximation of relevance. An LLM reading the actual text catches what geometry misses — at a price you only pay for the shortlist.",
    misconfigured: "Re-ranking a huge pool is slow and expensive for little gain; skipping it entirely lets a subtly-relevant chunk languish at rank 6 and never reach the prompt.",
    retrievalImpact: "Refines the final ordering — watch the before/after view to see exactly which chunks it rescued or demoted.",
    hallucinationImpact: "Better final ranking means the truly relevant evidence makes it into the prompt — fewer gaps for the model to fill.",
    params: ["useRerank", "topK"],
    related: ["top-k", "hybrid-search"],
    experiments: ["rerank-off"],
    confidence: "established",
    tryThis: "Turn re-ranking off, ask the same question, and compare which chunks make the final K — then check whether the answer's citations got weaker without the second pass.",
  },
  "prompt-construction": {
    id: "prompt-construction",
    term: "Prompt construction",
    technical: "Assembly of the final model input: system instructions + retrieved chunks (labelled with ids, trimmed to the context budget) + the user's question.",
    plain: "The model doesn't 'look things up' — it receives one long assembled message: the rules, the evidence, and your question. That package is everything it knows.",
    analogy: "A lawyer's briefing pack: instructions on how to argue, the exhibits (labelled for citation), and the question to address. Nothing outside the pack is admissible.",
    why: "This is where retrieval becomes generation. Labelling chunks [1], [2]… is what makes citations — and therefore verification — possible.",
    misconfigured: "Unlabelled chunks make grounding untraceable; a bloated system prompt eats the evidence budget; putting the question before the context measurably hurts attention.",
    retrievalImpact: "Downstream of retrieval, but budget trimming here decides which retrieved chunks SURVIVE into the model's view.",
    hallucinationImpact: "The prompt is the model's entire world — anything ambiguous, missing, or contradictory here is exactly where invention starts.",
    params: ["systemPrompt", "contextBudget"],
    related: ["system-prompt", "context-window", "generation", "citations"],
    experiments: ["starved-context"],
  },
  "system-prompt": {
    id: "system-prompt",
    term: "System prompt",
    technical: "Standing instructions that govern the model's behaviour for the whole exchange — here: answer only from context, cite chunk ids, admit when the answer isn't present.",
    plain: "The model's job description: what it may use, how to show its sources, and what to do when it doesn't know.",
    analogy: "Courtroom rules read before testimony: speak only to the evidence, cite your exhibits, and say 'I don't recall' rather than guess.",
    why: "Without explicit grounding rules the model happily blends document facts with its training memory — the citation requirement is what makes answers verifiable.",
    misconfigured: "Vague instructions ('be helpful') invite training-data leakage; forgetting the 'say when you don't know' clause converts every gap into a confident guess.",
    retrievalImpact: "None directly — but it decides how faithfully the model USES what retrieval delivered.",
    hallucinationImpact: "The single cheapest hallucination control in the pipeline: strict grounding language + mandatory citations + permission to say 'not in the document'.",
    params: ["systemPrompt"],
    related: ["prompt-construction", "grounding", "citations"],
    experiments: [],
  },
  "context-window": {
    id: "context-window",
    term: "Context window / budget",
    technical: "The token capacity allocated to retrieved evidence in the prompt. Chunks are packed in rank order until the budget is exhausted; the rest are dropped.",
    plain: "A container of fixed size for evidence. The best chunks go in first; when it's full, everything else — however relevant — is left out.",
    analogy: "A carry-on suitcase: pack your most important items first, because when it's full, the airline doesn't care what you left on the floor.",
    why: "Model input is finite and priced per token. The budget forces an explicit, visible decision about what the model gets to see.",
    misconfigured: "Too small: the second-best chunk (often the one with the caveat!) gets evicted. Larger than needed: you pay for padding and dilute the model's attention.",
    retrievalImpact: "The final gate of retrieval — a retrieved chunk that doesn't fit was, from the model's perspective, never retrieved.",
    hallucinationImpact: "Evicted evidence is the sneakiest hallucination source: retrieval 'worked', yet the model never saw the fact and improvised.",
    params: ["contextBudget", "topK", "chunkSize"],
    related: ["prompt-construction", "tokenization", "top-k"],
    experiments: ["starved-context", "giant-chunks"],
    tryThis: "Shrink the context budget until the prompt view shows a retrieved chunk being dropped, then ask a question that needed it — the sneakiest failure mode, made visible.",
  },
  "generation": {
    id: "generation",
    term: "Generation",
    technical: "Autoregressive token-by-token production of the answer by the LLM (here: gemini flash), conditioned solely on the assembled prompt.",
    plain: "The model writes the answer one token at a time, each choice based on the instructions, the evidence, and everything it has written so far.",
    analogy: "An expert answering from the briefing pack you handed over — articulate and fast, but able to speak only to what's in the pack (if the rules are good).",
    why: "This is the step users actually came for; everything before it exists to make this step ACCOUNTABLE instead of improvised.",
    misconfigured: "Excessive temperature adds randomness to a factual task; a tiny max-tokens cap truncates answers mid-sentence; missing grounding rules let it freestyle.",
    retrievalImpact: "None — generation consumes retrieval's output. But its quality makes retrieval failures visible (or papering-over invisible).",
    hallucinationImpact: "This is where hallucination physically happens: any token not supported by the context is invention. Every upstream control exists to constrain this moment.",
    params: ["temperature", "maxTokens", "systemPrompt"],
    related: ["prompt-construction", "grounding", "temperature", "max-tokens"],
    experiments: ["starved-context"],
    visual: { glyph: "✦", hue: "#059669" },
  },
  "temperature": {
    id: "temperature",
    term: "Temperature",
    technical: "A sampling parameter scaling the randomness of token selection: low values concentrate probability on the likeliest tokens; higher values flatten the distribution.",
    plain: "The creativity dial: low = predictable and precise, high = varied and surprising. For answering from documents, predictable is a feature.",
    analogy: "A jazz musician's freedom to improvise: wonderful in a solo, unwelcome when reading the terms of a contract aloud.",
    why: "The same model serves creative and factual tasks; temperature is how you tell it which mode this is.",
    misconfigured: "High temperature on a grounded Q&A task means the same question can yield different answers — and 'different' sometimes means 'less supported by the evidence'.",
    retrievalImpact: "None — it acts after retrieval is finished.",
    hallucinationImpact: "Higher temperature raises the probability of tokens that wander from the evidence; it doesn't cause hallucination alone, but it loosens the guardrails.",
    params: ["temperature"],
    related: ["generation", "max-tokens"],
    experiments: [],
    tryThis: "Ask the same question twice at temperature 0, then twice at the maximum — grounded answers should barely change, and what varies is exactly what the evidence didn't pin down.",
  },
  "max-tokens": {
    id: "max-tokens",
    term: "Max output tokens",
    technical: "A hard ceiling on the number of tokens the model may generate; generation halts at the cap regardless of completeness.",
    plain: "The answer's maximum length. Hit the cap and the answer just… stops, mid-thought if necessary.",
    analogy: "An exam answer box: when you run out of lines, your answer ends whether or not you finished the sentence.",
    why: "Output tokens are the most expensive tokens, and unbounded generation means unbounded cost and latency — the cap makes both predictable.",
    misconfigured: "Too low truncates answers (and can cut off the citations at the end!); needlessly high just raises your worst-case cost and latency envelope.",
    retrievalImpact: "None — the cap acts on the answer being written, after retrieval has completely finished its work.",
    hallucinationImpact: "Mostly neutral — but a truncated answer can LOOK wrong or unsupported, and truncation mid-citation destroys verifiability.",
    params: ["maxTokens"],
    related: ["generation", "tokenization", "cost-economics"],
    experiments: [],
  },
  "grounding": {
    id: "grounding",
    term: "Grounding",
    technical: "Mapping each answer sentence back to the retrieved chunks that support it, via the citation markers the model was instructed to emit.",
    plain: "Every sentence of the answer is linked to the exact passage it came from — hover a sentence here and watch its source light up.",
    analogy: "Footnotes in a research paper: the difference between 'trust me' and 'see page 12'.",
    why: "An unverifiable answer from a RAG system is just a chatbot with extra steps. Grounding converts answers into checkable claims.",
    misconfigured: "Without enforced citation markers there is nothing to trace; sloppy sentence-splitting mis-assigns citations and 'verifies' the wrong sentence.",
    retrievalImpact: "None — it audits retrieval's end product rather than changing it.",
    hallucinationImpact: "Grounding is the hallucination DETECTOR: a sentence with no supporting chunk is exactly where to look first.",
    params: ["systemPrompt"],
    related: ["citations", "hallucination", "evaluation", "faithfulness"],
    experiments: [],
    visual: { glyph: "⚓", hue: "#0891B2" },
    tryThis: "Hover each sentence of an answer and watch its source chunk light up — then find a sentence with no citation and ask yourself where it came from.",
  },
  "citations": {
    id: "citations",
    term: "Citations",
    technical: "Inline chunk-id markers ([2]) the model is required to emit after each claim, parsed back into sentence→chunk links after generation.",
    plain: "The little [2] after a sentence is the model showing its work — it points at the exact passage that sentence relies on.",
    analogy: "Receipts. Anyone can claim the expense; the receipt makes it auditable.",
    why: "Citations are the mechanical link that makes grounding, evidence tracing, and hallucination detection possible at all.",
    misconfigured: "If the system prompt doesn't demand them, most answers arrive citation-free — unverifiable. If chunk labels aren't in the prompt, the model cites ids that don't exist.",
    retrievalImpact: "None directly — but citation patterns reveal retrieval quality: chunks retrieved yet never cited were probably noise.",
    hallucinationImpact: "Uncited sentences are the natural habitat of hallucinations — the absence of a receipt is itself a signal.",
    params: ["systemPrompt"],
    related: ["grounding", "hallucination", "prompt-construction"],
    experiments: [],
  },
  "evaluation": {
    id: "evaluation",
    term: "Evaluation (LLM-as-judge)",
    technical: "A separate LLM call scoring the (question, context, answer) triple on faithfulness, relevance, context precision/recall, and hallucination risk. A judgment, not ground truth.",
    plain: "After answering, a second AI grades the answer: did it stick to the evidence, did it address the question, was the retrieved evidence any good?",
    analogy: "A code review: not mathematically guaranteed correct, but a systematic second reading that catches most problems — and is honest about being an opinion.",
    why: "Without measurement, tuning RAG is guesswork. Scores turn 'feels better' into 'faithfulness went from 78 to 95 when we added overlap'.",
    misconfigured: "Treating judge scores as ground truth is the trap — judges have biases (e.g. favouring fluent answers). Use scores comparatively, between configurations.",
    retrievalImpact: "None on retrieval itself; context precision/recall scores tell you how retrieval is doing.",
    hallucinationImpact: "Evaluation doesn't reduce risk — it MEASURES it, which is what makes deliberate reduction possible.",
    params: [],
    related: ["faithfulness", "answer-relevance", "context-precision", "context-recall", "hallucination"],
    experiments: ["rerank-off", "no-overlap"],
    confidence: "debated",
    history: "LLM-as-judge emerged around 2023 (RAGAS, MT-Bench) when evaluation at scale outgrew human panels. Its biases — favouring fluent, longer, self-similar answers — are documented and actively researched, which is why scores here are labelled judgments, not truth.",
  },
  "faithfulness": {
    id: "faithfulness",
    term: "Faithfulness",
    technical: "The degree (0–100) to which every claim in the answer is entailed by the retrieved context — the primary anti-hallucination metric.",
    plain: "Did the answer stick to the document, or did it add things? 100 means every sentence is backed by the retrieved text.",
    analogy: "A journalist's fact-check: every sentence in the article must trace to a source in the notes — anything else is editorialising.",
    why: "It isolates the failure users fear most: confident statements the document never made.",
    misconfigured: "Optimising ONLY faithfulness produces useless answers — 'the document does not say' is perfectly faithful. Balance it against answer relevance.",
    retrievalImpact: "Low faithfulness with good retrieval points at generation (prompt rules, temperature); low faithfulness with bad retrieval points upstream.",
    hallucinationImpact: "It is the inverse of hallucination — the two scores should roughly mirror each other, and divergence is itself diagnostic.",
    params: ["systemPrompt", "temperature"],
    related: ["hallucination", "grounding", "evaluation"],
    experiments: ["starved-context"],
  },
  "answer-relevance": {
    id: "answer-relevance",
    term: "Answer relevance",
    technical: "How directly the generated answer addresses the user's actual question (0–100), independent of whether it's grounded.",
    plain: "Did it answer what you asked? An answer can be perfectly faithful to the document and still dodge the question.",
    analogy: "Asking for directions and receiving an accurate, beautifully-sourced history of the neighbourhood.",
    why: "Faithfulness alone rewards evasion. Relevance keeps the system honest about actually being useful.",
    misconfigured: "Chasing relevance without faithfulness produces confident, on-topic fabrication — the worst quadrant.",
    retrievalImpact: "Low relevance often traces to retrieval fetching tangential chunks — the model answered the question the EVIDENCE suggested, not the one asked.",
    hallucinationImpact: "Pressure to be relevant with weak evidence is precisely the pressure that produces hallucination — watch these two metrics fight.",
    params: ["topK", "threshold"],
    related: ["faithfulness", "evaluation", "context-precision"],
    experiments: ["top-k-1"],
  },
  "context-precision": {
    id: "context-precision",
    term: "Context precision",
    technical: "The fraction of retrieved context that was actually relevant to the question — a purity measure of the evidence set.",
    plain: "Of the passages retrieved, how many were actually useful? Low precision means the briefing pack was padded with irrelevant pages.",
    analogy: "Signal-to-noise on a radio: the message may be in there, but the static makes it harder to hear.",
    why: "Irrelevant context isn't free — it costs tokens, dilutes attention, and gives the model raw material for confusion.",
    misconfigured: "Fixing low precision by raising the threshold too far flips the problem into low recall — the dials trade off.",
    retrievalImpact: "A direct report card on threshold, α, and top-K choices.",
    hallucinationImpact: "Noisy context invites the model to weave irrelevant details into the answer — precision is a hallucination input, not just a cost issue.",
    params: ["threshold", "topK", "hybridAlpha"],
    related: ["context-recall", "similarity-threshold", "top-k", "evaluation"],
    experiments: ["top-k-8"],
  },
  "context-recall": {
    id: "context-recall",
    term: "Context recall",
    technical: "The fraction of the information NEEDED to answer that was actually present in the retrieved context — a completeness measure.",
    plain: "Did retrieval find everything the answer required? Low recall means part of the true answer never reached the model.",
    analogy: "Packing for a trip: precision asks 'did you pack junk?', recall asks 'did you forget your passport?'.",
    why: "The most dangerous retrieval failure is invisible: the answer LOOKS complete, but a missing caveat or condition never made it into the prompt.",
    misconfigured: "Chasing recall by inflating top-K and dropping the threshold destroys precision — the classic trade-off, tunable live in this app.",
    retrievalImpact: "The completeness score of the whole retrieval stack: chunking granularity, search blend, K, and budget all show up here.",
    hallucinationImpact: "Missing evidence is the #1 hallucination trigger — the model fills the gap, fluently and wrongly.",
    params: ["topK", "threshold", "chunkSize", "contextBudget"],
    related: ["context-precision", "top-k", "chunk-overlap", "evaluation"],
    experiments: ["top-k-1", "starved-context"],
  },
  "hallucination": {
    id: "hallucination",
    term: "Hallucination",
    technical: "Generated content not supported by (or contradicting) the provided context — fluent, confident, and unmarked; measured here as a 0–100 risk score by the judge.",
    plain: "When the model states something the document never said — and sounds completely sure about it. The whole point of RAG is to make this rare and detectable.",
    analogy: "A witness who, rather than admit they didn't see something, fills the gap with a vivid, plausible, invented memory.",
    why: "This is RAG's reason to exist: retrieval supplies evidence, grounding rules demand its use, citations expose violations, evaluation measures the leak rate.",
    misconfigured: "Every upstream misconfiguration funnels here — split facts, missed retrieval, evicted evidence, loose prompts, hot sampling all raise the same score.",
    retrievalImpact: "Not a retrieval property itself, but the sharpest symptom of retrieval failure available.",
    hallucinationImpact: "It IS the risk. The interesting lesson: it's an engineering quantity you can measure and reduce, not a mysterious model mood.",
    params: ["systemPrompt", "temperature", "threshold", "topK"],
    related: ["faithfulness", "grounding", "citations", "context-recall"],
    experiments: ["no-overlap", "starved-context", "top-k-1"],
    confidence: "evolving",
    history: "The term crossed from computer vision into language research around 2017–2020 and went mainstream with chatbots. Some researchers argue for 'confabulation' instead — the model isn't perceiving wrongly, it's filling gaps in what it knows, exactly like the witness in the analogy.",
    visual: { glyph: "▲", hue: "#D97706" },
  },
  "embedding-projection": {
    id: "embedding-projection",
    term: "3D projection (PCA)",
    technical: "Principal Component Analysis compressing 768-dimensional embeddings to their 3 highest-variance axes for visualisation. Distances are approximate; neighbourhoods are real.",
    plain: "Real embeddings live in 768 dimensions — undrawable. We keep the 3 directions along which chunks differ most, so you can SEE the clusters that search operates on.",
    analogy: "A world map: the globe flattened loses some distances, but which cities are neighbours survives — and that's what you navigate by.",
    why: "Semantic space is the least intuitive idea in RAG; seeing your own document form clusters makes 'similarity = distance' click like nothing else.",
    misconfigured: "Reading the projection as exact is the error: two points touching in 3D can be moderately apart in 768-D. Trust the similarity scores; use the picture for intuition.",
    retrievalImpact: "None — retrieval runs on the full vectors. The projection is honest visualisation, not the search mechanism.",
    hallucinationImpact: "None directly — but seeing a query land far from every cluster explains WHY retrieval came back empty.",
    params: [],
    related: ["embeddings", "cosine-similarity", "semantic-search"],
    experiments: [],
  },
  "cost-economics": {
    id: "cost-economics",
    term: "Cost economics",
    technical: "Per-token pricing across operations: embedding input (~$0.02/1M), generation input (~$0.25/1M), generation output (~$2.00/1M) — output tokens cost ~80× embedding tokens.",
    plain: "Every question has a price, dominated by the answer's output tokens. Most parameter dials are secretly cost dials too.",
    analogy: "Utility billing: embedding is the cheap off-peak rate, model output is premium peak pricing — and the meter is running on both.",
    why: "RAG design is engineering under a budget: top-K, chunk size, context budget, and re-ranking all move the per-question price. Seeing cost live builds the intuition.",
    misconfigured: "Ignoring cost until the invoice: oversized K + generous budgets + rerank-everything can 10× the per-question price for marginal quality gains.",
    retrievalImpact: "None on quality directly — but cost pressure is why retrieval exists at all (versus stuffing entire documents into every prompt).",
    hallucinationImpact: "None — though over-aggressive cost cutting (starved context, K=1) buys cheapness with hallucination risk.",
    params: ["topK", "maxTokens", "contextBudget", "useRerank"],
    related: ["tokenization", "latency", "top-k", "max-tokens"],
    experiments: ["rerank-off", "top-k-8"],
  },
  "latency": {
    id: "latency",
    term: "Latency",
    technical: "Wall-clock time per stage. Local stages (chunking, scoring) run in milliseconds; network stages (embedding, generation, re-rank, evaluation) dominate at 0.5–10 s each.",
    plain: "Where the waiting happens. Almost all of it is the AI API calls — the local math is effectively free.",
    analogy: "Cooking a meal: chopping (local compute) takes seconds; the oven (model calls) is what you actually wait for — and more dishes means more oven time.",
    why: "Users feel latency before they judge quality. Knowing WHICH stage costs time tells you what an optimisation is worth.",
    misconfigured: "Adding LLM passes (re-rank, evaluation) without watching the timeline quietly doubles response time; huge max-tokens stretches the longest stage further.",
    retrievalImpact: "None on quality — but latency budgets often force the precision/recall compromises that do affect it.",
    hallucinationImpact: "None directly. Beware 'optimising' latency by removing the exact stages (re-rank, evaluation) that catch bad answers.",
    params: ["useRerank", "maxTokens", "topK"],
    related: ["cost-economics", "reranking", "generation"],
    experiments: ["rerank-off"],
  },
};

export const CONCEPT_IDS = Object.keys(CONCEPTS) as ConceptId[];

/* ── coverage maps (CI-enforced) ─────────────────────────────────── */

/** Every pipeline stage explains itself through exactly one lead concept. */
export const STAGE_CONCEPT: Record<StageId, ConceptId> = {
  upload: "document-ingestion",
  parse: "pdf-parsing",
  clean: "text-cleaning",
  chunk: "chunking",
  tokenize: "tokenization",
  embed: "embeddings",
  index: "vector-index",
  query: "query-embedding",
  retrieve: "hybrid-search",
  rerank: "reranking",
  prompt: "prompt-construction",
  generate: "generation",
  ground: "grounding",
  evaluate: "evaluation",
};

/** Every tunable parameter explains itself through exactly one lead concept. */
export const PARAM_CONCEPT: Record<keyof RagParams, ConceptId> = {
  chunkSize: "chunking",
  chunkOverlap: "chunk-overlap",
  topK: "top-k",
  threshold: "similarity-threshold",
  hybridAlpha: "hybrid-search",
  useRerank: "reranking",
  temperature: "temperature",
  maxTokens: "max-tokens",
  contextBudget: "context-window",
  systemPrompt: "system-prompt",
};
