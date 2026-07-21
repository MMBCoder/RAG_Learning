# RAG Pipeline Visualizer
Ab8RN6KOnYB5zUI1rDRshF0A2Txd9embTlTKfnQjERYqsnqmAw

An education-first, interactive visualizer for a production Retrieval-Augmented
Generation (RAG) pipeline. Upload a document, watch it become chunks → vectors →
a retrieved, re-ranked context → a grounded, cited answer — every stage live,
inspectable, and tunable.

This is a **standalone, self-contained** copy: UI, backend API routes, and the
provider integration are all included. `npm install` and go.

## For AI coding agents (GitHub Copilot, Cursor, Claude, etc.)

If you were asked to "run this app locally", follow these steps exactly:

1. **Prerequisite:** Node.js 18.18+ (20 LTS or newer recommended). Check with `node -v`.
2. From the project root (the folder containing this README and `package.json`):
   ```bash
   npm install
   npm run dev
   ```
3. Wait for the line `✓ Ready` and `Local: http://localhost:3000`.
4. Open **http://localhost:3000** — it redirects to `/learn/rag`, the visualizer.
5. Verify it works: the page loads a "RAG Pipeline Visualizer" header with an
   "upload file" and "load sample" button. Click **load sample** to run the full
   pipeline without uploading anything.

Do **not** change the framework, bundler, or ports unless asked. Do **not** run
`npm audit fix --force`. The app is already configured and a working
`GEMINI_API_KEY` is present in `.env.local`. If the port is busy, run
`npm run dev -- -p 3001` and use that port instead.

## Quick start

```bash
npm install          # install dependencies
npm run dev          # start the dev server on http://localhost:3000
```

Open **http://localhost:3000** — it redirects straight to the visualizer at
`/learn/rag`. A working Gemini key is already in `.env.local`; replace it with
your own for a real project.

### Production build

```bash
npm run build        # compile an optimized production build (webpack)
npm run start        # serve the production build on http://localhost:3000
```

### Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run typecheck` | TypeScript check, no emit |

### Troubleshooting

- **Port 3000 already in use** → `npm run dev -- -p 3001`.
- **The lab loads but answers/embeddings fail** → `GEMINI_API_KEY` is missing or
  invalid in `.env.local`. Get a free key at https://aistudio.google.com/apikey.
- **Images don't ingest** → same key; image ingestion uses Gemini vision.
- **`node` not found / old version** → install Node.js 20 LTS from https://nodejs.org.

## Configuration

All configuration is via environment variables in `.env.local`
(see `.env.local.example`):

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Embeddings, generation, rerank, evaluate, and image (vision) ingestion. Free key: https://aistudio.google.com/apikey |
| `OPENAI_API_KEY` | No | Cross-provider chat fallback if every Gemini model is unavailable. |
| `GEMINI_CHAT_MODELS` | No | Comma-separated override of the chat model fallback chain. |
| `RAG_ACCESS_CODE` | No | If set, gates the lab behind an unlock screen. Unset = open. |

> The key shipped in `.env.local` is a free-tier Gemini key. Rotate it for your
> own project — the app reads it from the environment, so no code change is needed.

## Supported input formats

The uploader accepts (≤ 10 MB):

- **PDF** — text extracted with pdf.js
- **Word** (`.docx`) — full text via mammoth
- **Excel** (`.xlsx` / `.xls` / `.csv`) — one page per sheet (all sheets covered)
- **Markdown / text** (`.md`, `.markdown`, `.mdx`, `.txt`)
- **Images** (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`) — transcribed and
  described by Gemini vision

There's also a built-in **sample guide** if you just want to click "load sample".

## Project structure

```
src/app/
  layout.tsx                     fonts (Space Grotesk / JetBrains Mono / Inter) + globals
  page.tsx                       redirects / → /learn/rag
  globals.css                    minimal reset
  learn/page.tsx                 small landing (back-link target)
  learn/rag/                     THE APP
    page.tsx                     renders <RagShell/>
    _components/                 all UI: canvas, store (zustand), pipeline, inspector,
                                 timeline, play mode, presentation, lab, coach, etc.
    _components/lib/parse.ts     multi-format ingestion dispatcher
    _components/lib/pdf.ts       pdf.js text extraction + preview
  learn/_components/shared/useIsMobile.ts
  api/rag/                       BACKEND (Next route handlers, node runtime)
    embed | generate | rerank | evaluate | extract-image | gate
    _lib/gemini.ts               Gemini client (chat, stream, embeddings, vision)
    _lib/openai.ts               optional OpenAI fallback
    _lib/gate.ts                 optional access gate + soft rate limit
    _lib/verdicts.ts             per-sentence grounding verdicts
public/pdf.worker.min.mjs        pdf.js worker (served at /pdf.worker.min.mjs)
```

## How it works

1. **Ingest** — `parse.ts` reduces any supported file to `PageText[]`, then the
   pipeline cleans → chunks → tokenizes.
2. **Embed & index** — chunks are embedded via `/api/rag/embed` (Gemini
   `gemini-embedding-001`, 768-dim) and projected to 3D (PCA) for the universe view.
3. **Query** — the question is embedded, scored against the index (hybrid
   semantic + keyword), optionally re-ranked (`/api/rag/rerank`), and packed into
   a prompt.
4. **Generate** — `/api/rag/generate` streams a grounded answer (NDJSON).
5. **Evaluate** — `/api/rag/evaluate` returns per-sentence grounding verdicts so
   unsupported claims are flagged.

All model calls go through Gemini (with an optional OpenAI fallback), behind a
stable client contract, so you can swap providers without touching the UI.

## Notes

- Build uses **webpack** (`next dev/build --webpack`), which is the tested path
  for the pdf.js worker and React Three Fiber.
- No Tailwind, no CSS framework — styling is inline + CSS variables.
- Tests from the original repo were omitted for a clean standalone build.
