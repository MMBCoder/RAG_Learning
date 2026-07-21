# RAG Pipeline Visualizer (V2)

An interactive, education-first visualization of a production Retrieval-
Augmented Generation pipeline. Lives at `/learn/rag`.

## What it is

Load a PDF (or the sample), watch it become a grounded, cited, evaluated
answer through all 14 stages — live, inspectable, and tunable. Built as
an "Interactive AI Museum": every screen sparks curiosity, every
animation reveals something invisible, every experiment produces an
"Aha!".

## Architecture (see `docs/RAG_V2_ARCHITECTURE.md`)

- **Three pillars** — Educational Experience (Concept Registry, persona
  system, learning journey, learning moments), Storytelling & Motion
  (motion grammar, Director, narrative arcs), Presentation & Demo.
- **The Concept Registry** (`_components/education/concepts.ts`) is the
  single educational source of truth: 33 concepts, CI-enforced coverage
  of every stage and parameter. No feature introduces explanations
  outside it.
- **Five personas** over one component tree via `usePersona()`.
- **State** is a composed Zustand store (`ragStore.ts`) of slices:
  pipeline, ui, journey, events, history, compare.
- **Server routes** (`src/app/api/rag/*`) hold the OpenAI key; the client
  never sees it.

## Feature map

Living data flow · replay timeline · cinematic Play/Presentation ·
Embedding Universe (R3F + data-view fallback) · Prompt MRI · context
vessel · cost meter · executive ROI · hallucination radar · Evidence
Detective · Inside GPT's Brain (streaming) · chunk life stories ·
retrieval heat map · A/B playground · AI Lab · Smart Coach.

## Build & test

```bash
npm run dev        # next dev --webpack (Turbopack is disabled on this repo)
npm run build      # next build --webpack
npm test           # vitest (unit)
npm run e2e        # playwright (deterministic, mocked — zero OpenAI cost)
```

Live smoke tests hit the real API and are gated behind `RAG_LIVE=1`.

## Deployment note

The API routes are public and spend real OpenAI credits. Set
`OPENAI_API_KEY` in the server environment (`.env.local` locally, project
env vars in production). Never commit the key.
