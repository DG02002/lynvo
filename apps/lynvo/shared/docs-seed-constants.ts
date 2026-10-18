export const DOCS_SEED_PROXY_KEY = "lynvo-docs-demo-proxy-key"
export const DOCS_SEED_PROXY_KEY_LOW = "lynvo-docs-demo-proxy-key-low"
export const DOCS_SEED_MANAGED_USAGE_OPERATION_ID_PREFIX =
  "docs-seed-managed-usage:"

const DOCS_SEED_PROXY_BALANCE = {
  remaining: 4_210,
  limit: 5_000,
} as const

const DOCS_SEED_PROXY_BALANCE_LOW = {
  remaining: 137,
  limit: 5_000,
} as const

export const DOCS_SEED_PROXY_FIXTURES = {
  healthy: {
    key: DOCS_SEED_PROXY_KEY,
    balance: DOCS_SEED_PROXY_BALANCE,
  },
  low: {
    key: DOCS_SEED_PROXY_KEY_LOW,
    balance: DOCS_SEED_PROXY_BALANCE_LOW,
  },
} as const

export type DocsSeedProxyBalanceKind = keyof typeof DOCS_SEED_PROXY_FIXTURES
