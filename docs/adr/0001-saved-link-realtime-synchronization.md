# ADR 0001: Saved link realtime synchronization

## Context

Lynvo keeps Convex access and refresh credentials behind the Worker in HttpOnly
session state. That boundary intentionally prevents native browser Convex
subscriptions. A one-shot Saved link HTTP snapshot therefore left another
active session stale, and deriving collection order from document `updatedAt`
could reject a valid deletion.

## Decision

Convex is the authoritative Saved link store. Every transaction that changes an
account’s collection advances one monotonic integer revision and coalesces one
`pendingBroadcast` row for that account. The Worker immediately attempts a
`saved-links.changed` event containing only the revision through the existing
hibernatable account Durable Object, then acknowledges the attempted revision.
The five-minute Worker cron retries pending rows in bounded batches.

The event is only an invalidation hint. Browsers compare revisions and refetch
an atomic `{ revision, results }` HTTP snapshot. They reconcile after every
socket connection, online transition, and visible transition. While visible,
online, signed in, and connected, a 30-second anti-entropy request reads only
the account revision and fetches the full snapshot only when newer.

Delivery is at least once. Duplicate, delayed, and out-of-order hints are
harmless. `broadcastRevision` means the Worker successfully attempted room
broadcast, not that every browser acknowledged it.

## Rejected alternatives

- Full Saved link payloads over WebSocket make a hint authoritative and expand
  the sensitive message surface.
- Direct browser Convex tokens violate the Worker-owned credential boundary.
- `BroadcastChannel`, service-worker messaging, and local-storage events do not
  synchronize independent browsers or devices.
- Fast full-list polling is costly and is not realtime.

## Failure and lifecycle semantics

A commit and its pending intent are atomic. Broadcast or acknowledgement
failure does not roll back a successful user mutation; the cron and browser
anti-entropy repair it. An old acknowledgement cannot clear a newer revision.
During final account erasure, the synchronization row is deleted with account
data and no new pending delivery is created after writes are disabled and valid
sessions are removed.

## Required protection

Tests must cover transactional revisions for every writer, pending coalescing,
service-token rejection, failed broadcast and acknowledgement retry, strict
message parsing, v2 revision caches, identity isolation, and deterministic
two-client convergence including lost events. Metrics and wide events may
contain revisions, counts, operation names, and failure classes, but never URLs,
titles, metadata, raw messages, credentials, or gateway tokens.
