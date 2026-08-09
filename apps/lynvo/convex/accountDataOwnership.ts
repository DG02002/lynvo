type AccountDataLifecycle = "erased" | "operational" | "global"

type StorageLedgerField =
  | "profileBytes"
  | "linkBytes"
  | "pluginServerBytes"
  | "pluginDomainBytes"
  | "pluginCredentialBytes"

export const ACCOUNT_DATA_CATALOG = {
  users: { lifecycle: "erased", storage: "profileBytes" },
  accountErasures: { lifecycle: "operational", storage: null },
  accountCapacity: { lifecycle: "global", storage: null },
  authSessions: { lifecycle: "erased", storage: null },
  authAccounts: { lifecycle: "erased", storage: null },
  authRefreshTokens: { lifecycle: "erased", storage: null },
  authVerificationCodes: { lifecycle: "erased", storage: null },
  authVerifiers: { lifecycle: "erased", storage: null },
  authRateLimits: { lifecycle: "operational", storage: null },
  links: { lifecycle: "erased", storage: "linkBytes" },
  workerSessionCleanupIntents: { lifecycle: "operational", storage: null },
  userStorageLedgers: { lifecycle: "erased", storage: null },
  userPluginServers: { lifecycle: "erased", storage: "pluginServerBytes" },
  userPluginDomains: { lifecycle: "erased", storage: "pluginDomainBytes" },
  userPluginCredentials: {
    lifecycle: "erased",
    storage: "pluginCredentialBytes",
  },
  usageCounters: { lifecycle: "erased", storage: null },
  usageEpochs: { lifecycle: "global", storage: null },
  deviceCodes: { lifecycle: "erased", storage: null },
  remoteCommands: { lifecycle: "erased", storage: null },
} as const satisfies Record<
  string,
  { lifecycle: AccountDataLifecycle; storage: StorageLedgerField | null }
>

type AccountDataTable = keyof typeof ACCOUNT_DATA_CATALOG
type TablesWithLifecycle<Lifecycle extends AccountDataLifecycle> = {
  [Table in AccountDataTable]: (typeof ACCOUNT_DATA_CATALOG)[Table]["lifecycle"] extends Lifecycle
    ? Table
    : never
}[AccountDataTable]

const tablesWithLifecycle = <Lifecycle extends AccountDataLifecycle>(
  lifecycle: Lifecycle
) =>
  Object.entries(ACCOUNT_DATA_CATALOG)
    .filter(([, entry]) => entry.lifecycle === lifecycle)
    .map(([table]) => table as TablesWithLifecycle<Lifecycle>)

export const ACCOUNT_DATA_OWNERSHIP = {
  erased: tablesWithLifecycle("erased"),
  operational: tablesWithLifecycle("operational"),
  global: tablesWithLifecycle("global"),
}

export const ACCOUNT_ERASURE_TABLES = ACCOUNT_DATA_OWNERSHIP.erased

type StorageDomainRegistry = {
  [Table in AccountDataTable]: (typeof ACCOUNT_DATA_CATALOG)[Table]["storage"]
}

export const ACCOUNT_DATA_STORAGE_REGISTRY = Object.fromEntries(
  Object.entries(ACCOUNT_DATA_CATALOG)
    .filter(([, entry]) => entry.lifecycle === "erased")
    .map(([table, entry]) => [table, entry.storage])
) as Pick<StorageDomainRegistry, TablesWithLifecycle<"erased">>
