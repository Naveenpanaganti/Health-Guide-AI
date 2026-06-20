# VitalGuide

A full-stack AI health companion that helps users understand symptoms, track personalized health plans, and learn about nutrition and wellness — all powered by OpenAI GPT-4o-mini.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `OPENAI_API_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 + shadcn/ui + wouter + Clerk auth
- API: Express 5 with SSE streaming for AI chat
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI gpt-4o-mini (direct SDK, streaming)
- Auth: Clerk (whitelabel proxy via `/api/__clerk`)
- Validation: Zod (`zod/v4`), Orval-generated client hooks
- Build: esbuild (CJS bundle)

## Where things live

- **DB schema**: `lib/db/src/schema/` — users.ts, plans.ts, logs.ts, conversations.ts, messages.ts
- **API contract**: `lib/api-spec/openapi.yaml` — source of truth for all routes
- **Generated hooks**: `lib/api-client-react/src/generated/api.ts`
- **Generated Zod schemas**: `lib/api-zod/src/generated/api.ts`
- **Backend routes**: `artifacts/api-server/src/routes/` — health, users, plans, logs, chat
- **Frontend pages**: `artifacts/vitalguide/src/pages/` — Landing, Dashboard, Onboarding, Checkup, Planner, Educate
- **Theme**: `artifacts/vitalguide/src/index.css` — teal/emerald palette

## Architecture decisions

- AI chat uses SSE streaming via Express — `res.setHeader("Content-Type", "text/event-stream")`, chunks as `data: {"content":"..."}`, closes with `data: [DONE]`
- Frontend reads SSE with native `fetch` + `ReadableStream` — not the generated mutation hook — to update assistant message bubble in real-time
- All React Query hooks require explicit `queryKey` in options (generated hooks enforce this via types): `useGetProfile({ query: { queryKey: getGetProfileQueryKey() } })`
- Clerk auth uses whitelabel proxy pattern — Clerk requests proxied through `/api/__clerk` so auth tokens work across the shared Replit proxy
- OpenAI SDK used directly on the server (not Replit AI integration proxy) since OPENAI_API_KEY is set

## Product

Three AI-powered modes, all personalized to the user's health profile:

1. **Health Checkup** — Conversational symptom assessment. Asks follow-up questions, gives safe preliminary guidance, detects emergencies and shows alert banners.
2. **Plan Tracker** — Manage medication/diet/fitness plans + log daily mood, sleep, water, food, symptoms. AI assistant helps stay on track.
3. **Health Education** — Myth-busting and nutrition/wellness Q&A. Suggested starter topics on empty state.

Users complete a 3-step onboarding (profile) before accessing AI features. Profile data is injected into every AI system prompt for personalized responses.

## User preferences

_No explicit preferences captured yet._

## Gotchas

- After any route changes, the API server must be restarted (it rebuilds via esbuild on start)
- `tailwindcss({ optimize: false })` in vite.config.ts — required so Clerk themes work without LightningCSS stripping their CSS variables
- `@layer theme, base, clerk, components, utilities;` must appear before `@import "tailwindcss"` in index.css — Clerk themes need the layer declared first
- All React Query hooks from the generated client require `queryKey` in the query options object — missing it causes a TS2741 error

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
