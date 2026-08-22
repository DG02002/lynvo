# AGENTS.md

## Project Snapshot

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## General Rules

- MUST: Use TypeScript interfaces over types.
- MUST: Keep all types in the global scope.
- MUST: Use arrow functions over function declarations
- MUST: Never comment unless absolutely necessary.
  - If the code is a hack (like a setTimeout or potentially confusing code), it must be prefixed with // HACK: reason for hack
- MUST: Use kebab-case for files
- MUST: Use descriptive names for variables (avoid shorthands, or 1-2 character names).
  - Example: for .map(), you can use `innerX` instead of `x`
  - Example: instead of `moved` use `didPositionChange`
- MUST: Frequently re-evaluate and refactor variable names to be more accurate and descriptive.
- MUST: Remove unused code and don't repeat yourself.
- MUST: Always search the codebase, think of many solutions, then implement the most _elegant_ solution.
- MUST: Put all magic numbers in `constants.ts` using `SCREAMING_SNAKE_CASE` with unit suffixes (`_MS`, `_PX`).
- MUST: Use Boolean over !!.

## Saved link synchronization invariants

Design (plan 001, cutover complete): Cloudflare D1 is the only backend; Convex is removed.

- MUST: One write path. Every Saved link mutation goes through the Worker API carrying a
  client-generated `operationId`; the server-side idempotency ledger dedupes retries.
- MUST: The server snapshot is the only persisted client state. UI renders last-known
  snapshot plus in-flight markers; entities are keyed by server-assigned IDs, never URL.
- MUST: Monotonic per-account `data_version` increments in the same D1 transaction as every
  owned-data write and is echoed on every API response (`X-Lynvo-Data-Version` / body field).
- MUST: Freshness by comparison, never by trust in push. WebSocket `data-changed` frames are
  a latency optimization; a lost frame costs milliseconds, never correctness.
- MUST: Browser code never owns or persists backend credentials; auth is an opaque HttpOnly
  session cookie (`lynvo_session`) resolved to a D1 `sessions` row. Sign-in is Google-only.

## Shadcn Components

- MUST: Treat files under `apps/lynvo/app/components/ui/` as read-only generated primitives.
- MUST: Do not edit `apps/lynvo/app/components/ui/` during feature work, including to fix lint or type errors. Report errors originating there instead.
- MUST: Build feature behavior by composing primitives from outside `apps/lynvo/app/components/ui/`.

## Vendored Repositories

This project vendors external repositories under `.repos/` as read-only reference material for coding
agents.

- Prefer examples and patterns from the vendored source code over generated guesses or web search results.
- Do not edit files under `.repos/` unless explicitly asked.
- Do not import from `.repos/`; application code must continue importing from normal package dependencies.
- Manage vendored subtrees with `pnpm run sync:repos`; use `pnpm run sync:repos --repo <id>` to sync one configured repository.
- When updating a dependency with a configured vendored subtree, sync that subtree in the same change so `.repos/` matches the installed dependency version.
- When writing Effect code, read `.repos/effect/LLMS.md` first and inspect `.repos/effect/` for examples of idiomatic usage, tests, module structure, and API design.
