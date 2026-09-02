# Contributing

## Developer Setup

See the [development guide](docs/internals/development.md#first-checkout) for
the initial checkout, development commands, tests, and local D1 workflow.

## Read This First

Lynvo is a small live product. We accept focused fixes and maintenance work,
but large feature requests and direction changes need discussion first.

You can report a bug or open a PR, but please keep it focused, tested, and
consistent with the product's direction.

Feature requests and proposals should start with a discussion or issue before
implementation.

PRs are automatically labeled with a `vouch:*` trust status and a `size:*` diff
size based on changed lines.

If you are an external contributor, expect `vouch:unvouched` until we
explicitly add you to [`.github/VOUCHED.td`](.github/VOUCHED.td).

## What We Are Most Likely To Accept

Small, focused bug fixes.

Small reliability fixes for retries, reconnects, partial failures, or stale
data.

Small performance improvements.

Tightly scoped maintenance work that clearly improves Lynvo without changing
its direction.

## What We Are Least Likely To Accept

Large PRs.

Drive-by feature work.

Opinionated rewrites.

Anything that expands product scope without us asking for it first.

If you open a 1,000+ line PR full of new features, we will probably close it
quickly and remember that you ignored the clearly written instructions.

## If You Still Want To Open A PR

Keep it small.

Explain exactly what changed.

Explain exactly why the change should exist.

Do not mix unrelated fixes together.

If the PR makes anything resembling a UI change, include clear before/after
images.

If the change depends on motion, timing, transitions, or interaction details,
include a short video.

If we have to guess what changed, we are much less likely to review it.

## Discuss Changes First

If you are thinking about a non-trivial change, start a discussion or issue
first. Use issues for bug reports and focused maintenance proposals.

That still does not mean we will want the PR, but it gives you a chance to
avoid wasting your time.

## Be Realistic

Opening a PR does not create an obligation on our side.

We may close it. We may ignore it. We may ask you to shrink it. We may
reimplement the idea ourselves later.

If you are fine with that, proceed.
