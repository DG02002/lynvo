import type {
  SealedProxyProviderCredential,
  StoredProxyProviderCredential,
} from "../../shared/proxy-provider-credentials"
import { executeOwnedWrite } from "./data-version"
import { PROXY_PROVIDER_COLUMNS, type ProxyProviderRow } from "./rows"
import {
  applyStorageMutation,
  byteLength,
  ensureStorageLedger,
} from "./storage-ledger"

const PROXY_PROVIDER_SCRAPE_DO = "scrape-do" as const

export interface ProxyProviderState {
  readonly provider: typeof PROXY_PROVIDER_SCRAPE_DO
  readonly hasKey: boolean
  readonly balanceRemaining: number | null
  readonly balanceLimit: number | null
  readonly balanceCheckedAt: number | null
}

const NO_KEY_STATE: ProxyProviderState = {
  provider: PROXY_PROVIDER_SCRAPE_DO,
  hasKey: false,
  balanceRemaining: null,
  balanceLimit: null,
  balanceCheckedAt: null,
}

const readProxyProviderRow = async (
  database: D1Database,
  userId: string
): Promise<ProxyProviderRow | null> =>
  await database
    .prepare(
      `SELECT ${PROXY_PROVIDER_COLUMNS} FROM user_proxy_providers WHERE user_id = ?1 AND provider = ?2`
    )
    .bind(userId, PROXY_PROVIDER_SCRAPE_DO)
    .first<ProxyProviderRow>()

export const readProxyProviderState = async (
  database: D1Database,
  userId: string
): Promise<ProxyProviderState> => {
  const row = await readProxyProviderRow(database, userId)
  if (!row || !row.token_ciphertext) {
    return NO_KEY_STATE
  }
  return {
    provider: PROXY_PROVIDER_SCRAPE_DO,
    hasKey: true,
    balanceRemaining: row.balance_remaining,
    balanceLimit: row.balance_limit,
    balanceCheckedAt: row.balance_checked_at,
  }
}

export const readSealedProxyProviderToken = async (
  database: D1Database,
  userId: string
): Promise<StoredProxyProviderCredential | null> => {
  const row = await readProxyProviderRow(database, userId)
  if (
    !row ||
    !row.token_ciphertext ||
    !row.token_nonce ||
    !row.token_algorithm ||
    row.token_version === null
  ) {
    return null
  }
  const sealed: StoredProxyProviderCredential = {
    ciphertext: row.token_ciphertext,
    nonce: row.token_nonce,
    algorithm: row.token_algorithm,
    version: row.token_version,
  }
  return row.legacy_plugin_server_id
    ? { ...sealed, legacyPluginServerId: row.legacy_plugin_server_id }
    : sealed
}

interface SaveProxyProviderKeyInput {
  readonly encrypted: SealedProxyProviderCredential | null
  readonly balance: {
    readonly remaining: number
    readonly limit: number
  } | null
  readonly now: number
}

export const saveProxyProviderKey = async (
  database: D1Database,
  userId: string,
  input: SaveProxyProviderKeyInput
): Promise<{ success: boolean; dataVersion: number }> => {
  const existing = await readProxyProviderRow(database, userId)
  const preparation = await ensureStorageLedger(database, userId, input.now)
  // The provider key is plugin-server storage; its bytes ride the
  // pluginServerBytes ledger domain. Removing the key deletes the row.
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "pluginServerBytes",
      currentBytes: existing ? byteLength(existing) : 0,
      nextBytes: input.encrypted
        ? byteLength({
            user_id: userId,
            provider: PROXY_PROVIDER_SCRAPE_DO,
            legacy_plugin_server_id: null,
            token_ciphertext: input.encrypted.ciphertext,
            token_nonce: input.encrypted.nonce,
            token_algorithm: input.encrypted.algorithm,
            token_version: input.encrypted.version,
            balance_remaining: input.balance?.remaining ?? null,
            balance_limit: input.balance?.limit ?? null,
            balance_checked_at: input.balance ? input.now : null,
            created_at: existing?.created_at ?? input.now,
            updated_at: input.now,
          })
        : 0,
      savedLinkCountDelta: 0,
    },
    now: input.now,
  })
  const writeStatement = input.encrypted
    ? database
        .prepare(
          `INSERT INTO user_proxy_providers (user_id, provider, legacy_plugin_server_id, token_ciphertext, token_nonce, token_algorithm, token_version, balance_remaining, balance_limit, balance_checked_at, created_at, updated_at)
           VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
           ON CONFLICT (user_id, provider) DO UPDATE SET
             legacy_plugin_server_id = NULL,
             token_ciphertext = excluded.token_ciphertext,
             token_nonce = excluded.token_nonce,
             token_algorithm = excluded.token_algorithm,
             token_version = excluded.token_version,
             balance_remaining = excluded.balance_remaining,
             balance_limit = excluded.balance_limit,
             balance_checked_at = excluded.balance_checked_at,
             updated_at = excluded.updated_at`
        )
        .bind(
          userId,
          PROXY_PROVIDER_SCRAPE_DO,
          input.encrypted.ciphertext,
          input.encrypted.nonce,
          input.encrypted.algorithm,
          input.encrypted.version,
          input.balance?.remaining ?? null,
          input.balance?.limit ?? null,
          input.balance ? input.now : null,
          existing?.created_at ?? input.now,
          input.now
        )
    : database
        .prepare(
          "DELETE FROM user_proxy_providers WHERE user_id = ?1 AND provider = ?2"
        )
        .bind(userId, PROXY_PROVIDER_SCRAPE_DO)
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      ...ledgerMutation.statements,
      writeStatement,
    ],
  })
  return { success: true, dataVersion }
}

interface UpdateProxyProviderBalanceInput {
  readonly balance: {
    readonly remaining: number
    readonly limit: number
  }
  readonly now: number
}

export const updateProxyProviderBalance = async (
  database: D1Database,
  userId: string,
  input: UpdateProxyProviderBalanceInput
): Promise<{ success: boolean; dataVersion: number }> => {
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      database
        .prepare(
          `UPDATE user_proxy_providers SET balance_remaining = ?3, balance_limit = ?4, balance_checked_at = ?5, updated_at = ?5 WHERE user_id = ?1 AND provider = ?2`
        )
        .bind(
          userId,
          PROXY_PROVIDER_SCRAPE_DO,
          input.balance.remaining,
          input.balance.limit,
          input.now
        ),
    ],
  })
  return { success: true, dataVersion }
}
