import type { OwnedWriteGuard } from "./data-version"

export interface SavedLinkMetaAppliedLink {
  readonly metaJson: string
  readonly updatedAt: number
}

export interface SavedLinkMetaAppliedState extends SavedLinkMetaAppliedLink {
  readonly linkId: string
}

// One post-state predicate for an optimistic saved-link metadata write,
// numbered per embedding statement's bind layout:
// - version bump: ?1 user id, guard bindings ?2–?4
// - storage ledger: ?1 user, ?2/?4 deltas, ?3 count, ?5 timestamp,
//   condition bindings ?6–?8
// - operation link: ?1 user, ?2 operation id, ?3 link id (reused in the
//   subquery), ?4/?5 applied link
export const SAVED_LINK_META_APPLIED_GUARD_SQL =
  "SELECT 1 FROM links WHERE id = ?2 AND user_id = ?1 AND meta_json IS ?3 AND updated_at = ?4"

export const SAVED_LINK_META_APPLIED_LEDGER_SQL =
  "SELECT 1 FROM links WHERE id = ?6 AND user_id = ?1 AND meta_json IS ?7 AND updated_at = ?8"

export const SAVED_LINK_META_APPLIED_OPERATION_LINK_SQL =
  "SELECT 1 FROM links WHERE id = ?3 AND user_id = ?1 AND meta_json IS ?4 AND updated_at = ?5"

/**
 * Conditions asserting one optimistic metadata write applied, so a lost
 * race moves no data, ledger delta, or version. The predicate cannot
 * distinguish this write from a concurrent write of byte-identical
 * metadata in the same millisecond; that interleaving can double-apply
 * one ledger delta. Retries reuse the caller's `now`, so `updated_at` is
 * not monotonic across attempts; nothing reads it as a clock.
 */
export const savedLinkMetaAppliedConditions = (
  state: SavedLinkMetaAppliedState
) => ({
  ledgerCondition: {
    conditionSql: SAVED_LINK_META_APPLIED_LEDGER_SQL,
    conditionBindings: [state.linkId, state.metaJson, state.updatedAt] as const,
  },
  appliedLink: { metaJson: state.metaJson, updatedAt: state.updatedAt },
  guard: {
    conditionSql: SAVED_LINK_META_APPLIED_GUARD_SQL,
    conditionBindings: [state.linkId, state.metaJson, state.updatedAt] as const,
  },
})
