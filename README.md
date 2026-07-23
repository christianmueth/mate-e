# Mate-E

Mate-E is an AI workspace and adaptive learning app built with Next.js, Clerk, Prisma, and Postgres. It combines flashcard generation, guided tutoring, workspace continuity, whiteboard assistance, presentation planning, and operator-facing governance reports in one product.

## What the project does

- Turns source material into study assets such as flashcards.
- Tracks user progress, recovery patterns, and tutoring state over time.
- Provides workspace-native AI help for planning, whiteboarding, and presentation prep.
- Records reasoning and governance artifacts so adaptive behavior can be reviewed before it is trusted more broadly.

## How GPT-5.6 and Codex accelerated the build

Judges should read this section first: GPT-5.6 and Codex were used as implementation accelerators across product design, coding, debugging, and documentation, but the project scope and acceptance decisions stayed human-controlled.

Where they had the biggest impact:

- Accelerated first-pass implementation of API routes, UI wiring, and typed data contracts across flashcards, tutoring, whiteboard assistance, and presentation planning.
- Shortened debugging cycles by helping trace failures across request handlers, environment configuration, and integration boundaries.
- Helped generate and refine local smoke tests so the highest-risk AI workflows could be validated quickly without repeating full manual UI passes.
- Compressed documentation and operations work by drafting setup steps, test commands, and governance-oriented explanations directly from the codebase.

Key human decisions:

- The product was intentionally structured around bounded feature surfaces instead of an unconstrained chatbot.
- Adaptive behavior was kept reviewable through reasoning logs, shadow evaluation, and governance reports before expanding authority.
- Authentication, billing, database state, and operator-only controls were treated as product infrastructure rather than demo scaffolding.

How the tools were used:

- GPT-5.6 was used for reasoning through implementation choices, proposing architecture tradeoffs, drafting code paths, and surfacing edge cases.
- Codex was used for repo-aware code editing, iterative refactoring, targeted fixes, and fast patch generation inside the working project.

The practical result was faster iteration on a larger, more integrated product surface while preserving explicit human review over the final design and shipped behavior.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Prisma with PostgreSQL
- Clerk authentication
- Stripe billing
- OpenAI and external AI/transcript services for content generation and assistance
- Capacitor for Android packaging

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment variables

Create `.env.local` in the repo root.

Minimum variables for a useful local run:

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
OPENAI_API_KEY=...
FLASHCARDS_TEST_KEY=localtest
```

Optional variables used by specific features:

```env
SUPADATA_API_KEY=...
RUNPOD_API_KEY=...
RUNPOD_ENDPOINT=...
RUNPOD_ASR_ENDPOINT=...
RUNPOD_YOUTUBE_ENDPOINT=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PREMIUM_PRICE_ID=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
INTERNAL_OPERATOR_CLERK_USER_IDS=user_123,user_456
TUTORING_ADAPTIVE_RERANK_SHADOW=1
TUTORING_ADAPTIVE_RERANK_ENABLED=0
```

Notes:

- The app shell can boot without Clerk, but signed-in workspace flows require valid Clerk keys.
- Flashcards, tutoring, whiteboard assist, and presentation planning rely on AI credentials.
- Stripe variables are only needed if you want to exercise billing locally.

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma generate
```

If you are iterating on schema changes locally, `npx prisma migrate dev` is also fine.

### 4. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Sample data and test inputs

The repo already includes lightweight test assets you can use during demos and local validation:

- `sample-photosynthesis.srt`
- `sample-subtitle.srt`
- `site_content.html`

These are useful as copy/paste source material for flashcard generation and workspace flows.

For database-backed adaptive testing, the repo also includes a synthetic recovery seed script:

```bash
npm run reasoning:seed:synthetic-recovery -- --count 120 --seed 7 --reset
```

That script inserts synthetic `study_recovery` reasoning runs so the governance and recovery views have realistic data to inspect.

## How to run the main flows

### App development

```bash
npm run dev
```

### Production build check

```bash
npm run build
```

### Flashcards smoke test

Start the dev server, then run:

```powershell
$env:FLASHCARDS_TEST_KEY = "localtest"
npm run flashcards:smoketest -- --text "Photosynthesis converts light energy into chemical energy."
```

You can also test URL ingestion or file upload:

```powershell
$env:FLASHCARDS_TEST_KEY = "localtest"
npm run flashcards:smoketest -- --url "https://www.youtube.com/watch?v=VIDEO_ID" --cards 10
```

```powershell
$env:FLASHCARDS_TEST_KEY = "localtest"
npm run flashcards:smoketest -- --file "tmp/pptx-smoketest.pptx"
```

Create the PPTX fixture first if needed:

```bash
npm run pptx:fixture
```

### Workspace whiteboard assist smoke test

```powershell
$env:FLASHCARDS_TEST_KEY = "localtest"
npm run workspace:whiteboard:smoketest
```

### Workspace presentation planner smoke test

```powershell
$env:FLASHCARDS_TEST_KEY = "localtest"
npm run workspace:presentation:smoketest
```

### Governance report generation

```bash
npm run reasoning:report:weekly
```

This writes a dated bundle under `governance_reports/` with exports, summaries, and rollout decision artifacts.

## Key implementation decisions

- The app is organized around bounded product surfaces instead of a general-purpose chatbot. Each major experience has a dedicated route or API contract.
- Authentication, billing, and student/workspace state are first-class product infrastructure, not demo-only add-ons.
- Adaptive behavior is observable and reviewable through reasoning runs, shadow exports, and governance reports before authority expands.
- Local smoketests exist for the highest-risk AI flows so the team can validate contracts without clicking through the UI every time.

## Useful repo entry points

- `app/page.tsx` for the landing experience
- `app/app/workspace/page.tsx` for the signed-in workspace surface
- `app/api/flashcards/route.ts` for source-to-flashcards generation
- `app/api/tutoring/guide/route.ts` for guided tutoring behavior
- `app/api/workspace/whiteboard-image/route.ts` and related workspace routes for workspace assistance
- `prisma/schema.prisma` for the data model
- `docs/REASONING_ENGINE_ARCHITECTURE.md` for the deeper reasoning-system contract

## Deployment notes

- Run `npm run build` before deployment.
- Apply Prisma migrations in the target environment.
- Configure Clerk, database, AI, and Stripe environment variables before exercising protected or premium flows.
- Keep operator-only governance access restricted through `INTERNAL_OPERATOR_CLERK_USER_IDS`.
