# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Toodyloo — a full-stack todo app built with TanStack Start, React 19, Drizzle ORM, and Better Auth. Deployed on Netlify.

## Commands

```bash
pnpm dev              # Start dev server (port 3000)
pnpm build            # Production build
pnpm test             # Run Vitest
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm check            # Type check + lint
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema to DB (no migration files)
pnpm db:studio        # Open Drizzle Studio
```

Add shadcn components: `pnpm dlx shadcn@latest add <component>`

## Architecture

**Stack:** TanStack Start + React 19 + Drizzle ORM (PostgreSQL) + Better Auth + Tailwind v4 + shadcn/ui

### Key directories

- `src/routes/` — File-based routing (TanStack Router). `__root.tsx` is the root layout with providers.
- `src/lib/server/` — Server functions (`createServerFn`) for todos, categories, subtasks, AI, activity, email.
- `src/lib/tasks.ts` — **Single source of truth** for types: Zod schemas derived from Drizzle tables (`createSelectSchema`), plus input/output schemas and TypeScript types.
- `src/db/schema.ts` — Drizzle table definitions (todos, lists, subtasks, auth tables).
- `src/db/index.ts` — Drizzle client init (supports Netlify DB fallback).
- `src/components/ui/` — shadcn/ui primitives.
- `src/components/todos/`, `src/components/lists/` — Feature components.
- `src/lib/optimistic-operations/` — Optimistic update infrastructure (provider, hooks, mutation keys).
- `src/integrations/tanstack-query/` — QueryClient setup with retry/cache config.
- `src/routeTree.gen.ts` — Auto-generated route tree (do not edit manually).

### Data flow pattern

Route component → `useMutation`/`useQuery` with server function → `createServerFn` handler (runs on server) → Drizzle ORM query → PostgreSQL

### Auth pattern

- Server: `src/lib/auth.ts` — Better Auth instance with Drizzle adapter, email/password strategy
- Client: `src/lib/auth-client.ts` — `signIn`, `signUp`, `signOut`, `useSession` hook
- API route: `src/routes/api/auth/$.tsx` — catch-all handler for Better Auth endpoints

### Sentry instrumentation

All server functions should be wrapped with `Sentry.startSpan()`. Import as:
```tsx
import * as Sentry from '@sentry/tanstackstart-react'
```

Server-side Sentry init is in `instrument.server.mjs` (loaded via NODE_OPTIONS). Client-side init is in `src/router.tsx`. Structured logging helpers are in `src/lib/server/logging.ts`.

### Type safety approach

Drizzle schema → `createSelectSchema()` → Zod schemas → `z.infer<>` for TypeScript types. All defined in `src/lib/tasks.ts`. Input schemas (create/update) are also derived here.

### Optimistic updates

`OptimisticOperationsProvider` in root layout. Mutations use `onMutate` for client-side optimism. Mutation key factory in `src/lib/optimistic-operations/mutation-keys.ts`. Activity drawer replays optimistic + server operations.

## Environment Variables

Required: `DATABASE_URL`, `BETTER_AUTH_SECRET`
Optional: `BETTER_AUTH_URL`, `SENTRY_DSN`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `UNPOOLED_DATABASE_URL`
