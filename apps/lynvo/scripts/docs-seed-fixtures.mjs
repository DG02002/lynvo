/**
 * @typedef {import("../shared/docs-seed-constants").DocsSeedProxyBalanceKind} DocsSeedProxyBalanceKind
 * @typedef {Readonly<{
 *   displayName: string
 *   enabled: boolean
 *   proxy: Readonly<{ balance: DocsSeedProxyBalanceKind; enabled: boolean }> | undefined
 *   url: string
 * }>} DocsSeedPluginServerFixture
 */

/** @type {DocsSeedPluginServerFixture} */
export const DOCS_SEED_PRIMARY_PLUGIN_SERVER_FIXTURE = {
  url: "http://localhost:8788",
  displayName: "Lynvo Plugin Server",
  enabled: true,
  proxy: { balance: "healthy", enabled: true },
}

/** @type {readonly DocsSeedPluginServerFixture[]} */
export const DOCS_SEED_PLUGIN_SERVER_FIXTURES = [
  DOCS_SEED_PRIMARY_PLUGIN_SERVER_FIXTURE,
  {
    url: "http://localhost:8789",
    displayName: "Home Drive Index",
    enabled: true,
    proxy: { balance: "low", enabled: false },
  },
  {
    url: "http://localhost:8790",
    displayName: "Archive Index",
    enabled: false,
    proxy: undefined,
  },
]
