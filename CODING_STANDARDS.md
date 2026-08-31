# Coding standards

## Testing

Tautological tests considered harmful.

For every test, ask which production bug it would catch if the code regressed.
If there is no answer because the test re-implements the logic under test,
asserts equality, checks that a mock returns its configured value, mirrors a
static table (route lists, CSS class strings, config files) into assertions, or
checks type shapes the compiler already guarantees, delete it or rewrite it as
a behavioral test that observes the module through its public interface.

## Error prevention over error detection

Prefer changing the design so an error class cannot occur over writing a test
that detects the next occurrence.

Before writing a test that pins down a race, a double-apply, or an
out-of-bounds value, ask whether a design change removes the entire class:

- Read-modify-write races → conditional `UPDATE ... WHERE <expected previous
  state> RETURNING` inside one D1 `batch()` (batches are SQL transactions).
- Check-then-insert duplicates → `UNIQUE` constraint plus `ON CONFLICT`
  handling, never a pre-read.
- Double settle/refund → guard the state transition (`AND state = 'reserved'`)
  so the loser's statements no-op.
- Untagged unions of shapes → discriminated unions with exhaustive switches.
- Missing cleanup → ownership (attached storage, FK `ON DELETE`, TTL sweeps
  tied to creation in the same transaction), not discipline.

Tests then verify behavior, not the absence of a bug class the design already
excludes. Prefer deleting a shallow module (see the deletion test in
`.agents/skills/codebase-design`) over adding tests that compensate for its
weak interface.

## Lint policy

oxlint categories `correctness`, `suspicious`, and `perf` run as warnings, plus
explicitly selected complexity rules (`max-statements`, `max-params`,
`no-nested-ternary`, and friends). The `style` category stays off: its
highest-volume rules (`one-var`, `sort-keys`, `sort-imports`, `func-style`)
contradict the conventions in AGENTS.md (arrow functions, descriptive names)
and produce thousands of counterproductive warnings. Enable rules deliberately,
with the measured warning count in hand, not by flipping a category on.
