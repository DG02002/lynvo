# Coding standards

Tautological tests considered harmful.

Keep comments short. Delete any claim from comments that is derivable from the
code.

A general piece of advice for not just programming but most other problem solving: always favour subtraction over addition. You should always try to get the job done by taking something away first, and only if that isn’t working resort to adding something new.

If you can’t get away with removing something, the next step is to try just combining two things you already have. It’s easy to overlook these types of solutions if you don’t have a strong understanding of the entire system.

If you’ve exhausted your options and the only choice is to add something new, it’s important to analyse why. Often the need to add something brand new indicates that you’re diverging from established / implicit assumptions about design. This is worth scrutinising.

Style and safety rules that hold every contribution to one standard, as if
the codebase were written by a single careful person. Inconsistency is
treated as a bug, not a preference.

The mechanical standard is the gates: when `pnpm check` is green, formatting,
shape, dead code, and `any` bans are settled — the **Quality gates** section
of `docs/internals/development.md` lists the commands. The configs own those
rules, and this page does not restate them, because a restatement drifts.
What follows are the rules no gate can see, so review is their gate until
they gain one. A rule that bans a primitive names the safe helper that
replaces it.

## Readability

- Readable beats clever. If a reviewer must re-read a line, rewrite the line.
  Prefer smaller functions; deep nesting is a prompt to extract, not to
  indent further.

## Types and boundaries

- `any` is banned in app, Worker, and package source. At a decoding boundary,
  use an Effect Schema — not `typeof` narrowing, not chained assertions, not
  a cast.
- Unknown input is parsed once, at the edge: request bodies, Plugin Server
  responses, realtime frames, and storage values decode through their schema
  before they travel inward.
- Typed errors keep their code, status, cause, and retry metadata; magic
  strings at boundaries are regressions.

## Async, effects, and external calls

- Hook contracts are load-bearing: effect events only run from effects,
  dependency arrays are honest, and a deliberate exception carries a comment
  and a suppression at the exact line.
- A stale async result is a bug. Gate results by request identity, sequence,
  or abort signal before applying them to state.
- Every external read has a deadline, a size bound, and a cancellation path.
  Unbounded `.text()`, `.json()`, or `.arrayBuffer()` on an external response
  belongs behind the validated-fetch helpers, not in a source adapter; the
  redirect engine is shared in the protocol package.

## Data and the write path

- Every owned-data mutation asserts ownership in the same SQL statement,
  increments `data_version` in the same transaction, and threads the
  version into the response body and header. Worker tests drive these
  invariants through the public D1 functions and routes.
- Retries, reconnects, concurrent writers, and failed upstream calls are
  normal states, not error reports. Code is incomplete until the reverse
  paths — retry, refresh, cancel, remove, reopen, sign out — behave.

## Before review

A first draft — from any model, at any size — satisfies the rules above and
passes the gates. Paste exit codes, do not promise them.
