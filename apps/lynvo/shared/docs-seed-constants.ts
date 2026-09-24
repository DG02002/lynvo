export const DOCS_SEED_PROXY_KEY = "lynvo-docs-demo-proxy-key"
/** Selects Lynvo's generic Artwork and skips external lookup for docs captures. */
export const DOCS_SEED_ARTWORK_POLICY = "lynvo-generic" as const
export const DOCS_SEED_MANAGED_USAGE_OPERATION_ID_PREFIX =
  "docs-seed-managed-usage:"

export const DOCS_SEED_PROXY_BALANCE = {
  remaining: 4_210,
  limit: 5_000,
} as const
