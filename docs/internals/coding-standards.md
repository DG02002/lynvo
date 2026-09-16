# Coding standards

Tautological tests considered harmful.

Keep comments short. Delete any claim from comments that is derivable from the
code.

A general piece of advice for not just programming but most other problem solving: always favour subtraction over addition. You should always try to get the job done by taking something away first, and only if that isn’t working resort to adding something new.

If you can’t get away with removing something, the next step is to try just combining two things you already have. It’s easy to overlook these types of solutions if you don’t have a strong understanding of the entire system.

If you’ve exhausted your options and the only choice is to add something new, it’s important to analyse why. Often the need to add something brand new indicates that you’re diverging from established / implicit assumptions about design. This is worth scrutinising.

These standards are enforced rules, not decoration. Each rule below names the
gate that upholds it — a lint rule, a compiler flag, a test, or the review —
and when a rule has no mechanical gate yet, the two-axis code review is that
gate.

## Format and shape

- oxfmt owns formatting and oxlint owns the rest of the shape
  (`max-statements`, `max-params`). Never hand-format around the tools; both
  run on staged files and in CI, and warnings fail the build
  (`--deny-warnings`).
- Readable beats clever. If a reviewer must re-read a line, rewrite the
  line. Prefer smaller functions; deep nesting is a prompt to extract, not
  to indent further.
- Export only what another module imports. Unused exports, files, and
  dependencies fail `pnpm check` (knip), and `noUnusedLocals` /
  `noUnusedParameters` fail the typecheck. A symbol kept "for later" is dead
  code with a schedule.

## Types and boundaries

- `any` is banned in app, Worker, and package source
  (`typescript/no-explicit-any`). At a decoding boundary, use an Effect
  Schema — not `typeof` narrowing, not chained assertions, not a cast (the
  `anti-slop` plugin enforces the house idioms).
- Unknown input is parsed once, at the edge: request bodies, Plugin Server
  responses, realtime frames, and storage values decode through their schema
  before they travel inward. Typed errors keep their code, status, cause, and
  retry metadata; magic strings at boundaries are regressions.

## Async, effects, and external calls

- Hook contracts are load-bearing: effect events only run from effects,
  dependency arrays are honest, and a deliberate exception carries a
  comment and a `react-hooks` suppression at the exact line
  (`react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`).
- A stale async result is a bug. Gate results by request identity, sequence,
  or abort signal before applying them to state. (Enforced by review until a
  mechanical gate exists.)
- Every external read has a deadline, a size bound, and a cancellation
  path. Unbounded `.text()`, `.json()`, or `.arrayBuffer()` on an external
  response belongs behind the validated-fetch helpers, not in a source
  adapter. (Helpers enforced by review; the redirect engine is shared in the
  protocol package.)

## Data and the write path

- Every owned-data mutation asserts ownership in the same SQL statement,
  increments `data_version` in the same transaction, and threads the
  version into the response body and header. Worker tests drive these
  invariants through the public D1 functions and routes.
- Retries, reconnects, concurrent writers, and failed upstream calls are
  normal states, not error reports. Code is incomplete until the reverse
  paths — retry, refresh, cancel, remove, reopen, sign out — behave.

## The first-pass contract

Use this checklist as a map to the canonical rules above, not as a second
copy of them. A first draft — from any model, at any size — must satisfy all
eight items before review:

1. Boundary validation — see **Types and boundaries**.
2. Bounded, cancellable external reads — see **Async, effects, and external
   calls**.
3. Ownership checks on writes — see **Data and the write path**.
4. Staleness gating for async results — see **Async, effects, and external
   calls**.
5. Typed errors with code, status, and cause — see **Types and boundaries**.
6. One shared helper for shared risky behavior — see **Async, effects, and
   external calls**.
7. Discriminating coverage for reverse states — see **Data and the write
   path**.
8. All gates pass: `pnpm check`, `pnpm test`, `pnpm test:workers`,
   `pnpm build`, and `pnpm check:plugin-server-release`; paste exit codes,
   do not promise them.
