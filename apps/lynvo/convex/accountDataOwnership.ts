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
  savedLinkSynchronizationStates: { lifecycle: "erased", storage: null },
  workerSessionCleanupIntents: { lifecycle: "operational", storage: null },
  realtimeSessionRevocationIntents: {
    lifecycle: "operational",
    storage: null,
  },
  accountSettingsSynchronizationStates: {
    lifecycle: "erased",
    storage: null,
  },
  userStorageLedgers: { lifecycle: "erased", storage: null },
  userPluginServers: { lifecycle: "erased", storage: "pluginServerBytes" },
  userPluginDomains: { lifecycle: "erased", storage: "pluginDomainBytes" },
  userPluginCredentials: {
    lifecycle: "erased",
    storage: "pluginCredentialBytes",
  },
  usageCounters: { lifecycle: "erased", storage: null },
  managedExtractionOperations: { lifecycle: "erased", storage: null },
  usageEpochs: { lifecycle: "global", storage: null },
  deviceCodes: { lifecycle: "erased", storage: null },
  remoteCommands: { lifecycle: "erased", storage: null },
} as const satisfies Record<
  string,
  { lifecycle: AccountDataLifecycle; storage: StorageLedgerField | null }
>

type AccountDataTable = keyof typeof ACCOUNT_DATA_CATALOG
type TablesWithLifecycle<Lifecycle extends AccountDataLifecycle> = {
  [
    Table in AccountDataTable
  ]: (typeof ACCOUNT_DATA_CATALOG)[Table]["lifecycle"] extends Lifecycle
    ? Table
    : never
}[AccountDataTable]

const tablesWithLifecycle = <Lifecycle extends AccountDataLifecycle>(
  lifecycle: Lifecycle
) => {
  // SAFETY: Object.entries erases keys, but every key originates from ACCOUNT_DATA_CATALOG and the filter establishes the requested lifecycle.
  return Object.entries(ACCOUNT_DATA_CATALOG)
    .filter(([, entry]) => entry.lifecycle === lifecycle)
    .map(([table]) => table as TablesWithLifecycle<Lifecycle>)
}

export const ACCOUNT_DATA_OWNERSHIP = {
  erased: tablesWithLifecycle("erased"),
  operational: tablesWithLifecycle("operational"),
  global: tablesWithLifecycle("global"),
}

export const ACCOUNT_ERASURE_TABLES = ACCOUNT_DATA_OWNERSHIP.erased

type StorageDomainRegistry = {
  [Table in AccountDataTable]: (typeof ACCOUNT_DATA_CATALOG)[Table]["storage"]
}

export const ACCOUNT_DATA_STORAGE_REGISTRY = {
  users: ACCOUNT_DATA_CATALOG.users.storage,
  authSessions: ACCOUNT_DATA_CATALOG.authSessions.storage,
  authAccounts: ACCOUNT_DATA_CATALOG.authAccounts.storage,
  authRefreshTokens: ACCOUNT_DATA_CATALOG.authRefreshTokens.storage,
  authVerificationCodes: ACCOUNT_DATA_CATALOG.authVerificationCodes.storage,
  authVerifiers: ACCOUNT_DATA_CATALOG.authVerifiers.storage,
  links: ACCOUNT_DATA_CATALOG.links.storage,
  savedLinkSynchronizationStates:
    ACCOUNT_DATA_CATALOG.savedLinkSynchronizationStates.storage,
  accountSettingsSynchronizationStates:
    ACCOUNT_DATA_CATALOG.accountSettingsSynchronizationStates.storage,
  userStorageLedgers: ACCOUNT_DATA_CATALOG.userStorageLedgers.storage,
  userPluginServers: ACCOUNT_DATA_CATALOG.userPluginServers.storage,
  userPluginDomains: ACCOUNT_DATA_CATALOG.userPluginDomains.storage,
  userPluginCredentials: ACCOUNT_DATA_CATALOG.userPluginCredentials.storage,
  usageCounters: ACCOUNT_DATA_CATALOG.usageCounters.storage,
  managedExtractionOperations:
    ACCOUNT_DATA_CATALOG.managedExtractionOperations.storage,
  deviceCodes: ACCOUNT_DATA_CATALOG.deviceCodes.storage,
  remoteCommands: ACCOUNT_DATA_CATALOG.remoteCommands.storage,
} satisfies Pick<StorageDomainRegistry, TablesWithLifecycle<"erased">>
