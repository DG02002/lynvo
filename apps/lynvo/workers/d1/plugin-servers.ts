import {
  CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT,
  PLUGIN_SERVER_DEPENDENT_DELETE_LIMIT,
  PLUGIN_SERVER_REGISTRATION_SWEEP_BATCH_SIZE,
  PLUGIN_SERVER_REGISTRATION_TTL_MS,
} from "../constants"
import {
  createDataVersionBumpStatement,
  executeOwnedWrite,
  getDataVersion,
} from "./data-version"
import { createOpaqueId } from "./ids"
import {
  PLUGIN_DOMAIN_COLUMNS,
  PLUGIN_SERVER_COLUMNS,
  type PluginServerRow,
} from "./rows"
import {
  applyStorageMutation,
  byteLength,
  ensureStorageLedger,
  withAppliedMutation,
  type StorageLedgerPreparation,
} from "./storage-ledger"
import { deletePluginDomainDocument } from "./plugin-domains"

export interface PluginServerRecord {
  id: string
  userId: string
  baseUrl: string
  normalizedBaseUrl: string
  apiKeyCiphertext: string | null
  apiKeyNonce: string | null
  apiKeyAlgorithm: "AES-256-GCM" | null
  apiKeyVersion: number | null
  proxyTokenCiphertext: string | null
  proxyTokenNonce: string | null
  proxyTokenAlgorithm: "AES-256-GCM" | null
  proxyTokenVersion: number | null
  proxyBalanceRemaining: number | null
  proxyBalanceLimit: number | null
  proxyBalanceCheckedAt: number | null
  credentialStatus: "pending" | "ready" | "failed"
  credentialGeneration: number | null
  credentialAttemptId: string | null
  pendingExpiresAt: number | null
  failureReason: string | null
  manifest: string
  enabled: boolean
  priority: number
  verificationStatus: string
  lastVerifiedAt: number | null
  lastManifestRefreshAt: number | null
  createdAt: number
  updatedAt: number
}

const mapPluginServerRow = (row: PluginServerRow): PluginServerRecord => ({
  id: row.id,
  userId: row.user_id,
  baseUrl: row.base_url,
  normalizedBaseUrl: row.normalized_base_url,
  apiKeyCiphertext: row.api_key_ciphertext,
  apiKeyNonce: row.api_key_nonce,
  apiKeyAlgorithm: row.api_key_algorithm,
  apiKeyVersion: row.api_key_version,
  proxyTokenCiphertext: row.proxy_token_ciphertext,
  proxyTokenNonce: row.proxy_token_nonce,
  proxyTokenAlgorithm: row.proxy_token_algorithm,
  proxyTokenVersion: row.proxy_token_version,
  proxyBalanceRemaining: row.proxy_balance_remaining,
  proxyBalanceLimit: row.proxy_balance_limit,
  proxyBalanceCheckedAt: row.proxy_balance_checked_at,
  credentialStatus: row.credential_status,
  credentialGeneration: row.credential_generation,
  credentialAttemptId: row.credential_attempt_id,
  pendingExpiresAt: row.pending_expires_at,
  failureReason: row.failure_reason,
  manifest: row.manifest,
  enabled: row.enabled === 1,
  priority: row.priority,
  verificationStatus: row.verification_status,
  lastVerifiedAt: row.last_verified_at,
  lastManifestRefreshAt: row.last_manifest_refresh_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const normalizeBaseUrl = (baseUrl: string): string => {
  const url = new URL(baseUrl.trim())
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("Plugin Server base URL must use HTTPS.")
  }
  url.pathname = url.pathname.replace(/\/+$/, "")
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
}

const findPluginServerRow = async (
  database: D1Database,
  pluginServerId: string
): Promise<PluginServerRow | null> => {
  const row = await database
    .prepare(
      `SELECT ${PLUGIN_SERVER_COLUMNS} FROM user_plugin_servers WHERE id = ?1`
    )
    .bind(pluginServerId)
    .first<PluginServerRow>()
  return row ?? null
}

const requireOwnedPluginServerRow = async (
  database: D1Database,
  userId: string,
  pluginServerId: string
): Promise<PluginServerRow> => {
  const existing = await findPluginServerRow(database, pluginServerId)
  if (!existing || existing.user_id !== userId) {
    throw new Error("Plugin server not found or no longer available")
  }
  return existing
}

type PluginServerUpdateColumn = Exclude<
  keyof PluginServerRow,
  "id" | "updated_at"
>

const buildServerMutationStatements = (
  database: D1Database,
  preparation: StorageLedgerPreparation,
  pluginServerId: string,
  columns: readonly PluginServerUpdateColumn[],
  currentRow: PluginServerRow,
  nextRow: PluginServerRow,
  now: number
): D1PreparedStatement[] => {
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "pluginServerBytes",
      currentBytes: byteLength(currentRow),
      nextBytes: byteLength(nextRow),
      savedLinkCountDelta: 0,
    },
    now
  )
  const setClauses = columns
    .map((column, index) => `${column} = ?${index + 2}`)
    .join(", ")
  return [
    ...ledgerMutation.statements,
    database
      .prepare(
        `UPDATE user_plugin_servers SET ${setClauses}, updated_at = ?${columns.length + 2} WHERE id = ?1`
      )
      .bind(pluginServerId, ...columns.map((column) => nextRow[column]), now),
  ]
}

export interface PublicPluginServerRecord {
  id: string
  userId: string
  baseUrl: string
  manifest: string
  enabled: boolean
  priority: number
  verificationStatus: string
  hasProxyKey: boolean
  proxyBalanceRemaining: number | null
  proxyBalanceLimit: number | null
  lastVerifiedAt: number | null
  lastManifestRefreshAt: number | null
  createdAt: number
  updatedAt: number
}

const toPublicPluginServer = (
  record: PluginServerRecord
): PublicPluginServerRecord => ({
  id: record.id,
  userId: record.userId,
  baseUrl: record.baseUrl,
  manifest: record.manifest,
  enabled: record.enabled,
  priority: record.priority,
  verificationStatus: record.verificationStatus,
  hasProxyKey: Boolean(record.proxyTokenCiphertext),
  proxyBalanceRemaining: record.proxyBalanceRemaining,
  proxyBalanceLimit: record.proxyBalanceLimit,
  lastVerifiedAt: record.lastVerifiedAt,
  lastManifestRefreshAt: record.lastManifestRefreshAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
})

export const listPluginServers = async (
  database: D1Database,
  userId: string
): Promise<PublicPluginServerRecord[]> => {
  const { results } = await database
    .prepare(
      `SELECT ${PLUGIN_SERVER_COLUMNS} FROM user_plugin_servers WHERE user_id = ?1`
    )
    .bind(userId)
    .all<PluginServerRow>()
  const pluginServers: PublicPluginServerRecord[] = []
  for (const row of results) {
    if (row.credential_status === "ready") {
      pluginServers.push(toPublicPluginServer(mapPluginServerRow(row)))
    }
  }
  return pluginServers
}

export interface ServicePluginServerRecord extends PublicPluginServerRecord {
  apiKeyCiphertext: string
  apiKeyNonce: string
  apiKeyAlgorithm: "AES-256-GCM"
  apiKeyVersion: number
  proxyTokenCiphertext: string | null
  proxyTokenNonce: string | null
  proxyTokenAlgorithm: "AES-256-GCM" | null
  proxyTokenVersion: number | null
}

export const listReadyPluginServersForService = async (
  database: D1Database,
  userId: string
): Promise<ServicePluginServerRecord[]> => {
  const { results } = await database
    .prepare(
      `SELECT ${PLUGIN_SERVER_COLUMNS} FROM user_plugin_servers WHERE user_id = ?1`
    )
    .bind(userId)
    .all<PluginServerRow>()
  return results.flatMap((row) =>
    row.credential_status === "ready" &&
    row.api_key_ciphertext &&
    row.api_key_nonce &&
    row.api_key_algorithm &&
    row.api_key_version !== null
      ? [
          {
            ...toPublicPluginServer(mapPluginServerRow(row)),
            apiKeyCiphertext: row.api_key_ciphertext,
            apiKeyNonce: row.api_key_nonce,
            apiKeyAlgorithm: row.api_key_algorithm,
            apiKeyVersion: row.api_key_version,
            proxyTokenCiphertext: row.proxy_token_ciphertext,
            proxyTokenNonce: row.proxy_token_nonce,
            proxyTokenAlgorithm: row.proxy_token_algorithm,
            proxyTokenVersion: row.proxy_token_version,
          },
        ]
      : []
  )
}

export interface BeginRegistrationResult {
  id: string
  resumed: boolean
  generation: number
  attemptId: string
  dataVersion: number
}

export const beginPluginServerRegistration = async (
  database: D1Database,
  userId: string,
  input: { baseUrl: string; now: number }
): Promise<BeginRegistrationResult> => {
  const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl)
  const pendingExpiresAt = input.now + PLUGIN_SERVER_REGISTRATION_TTL_MS
  const attemptId = crypto.randomUUID()
  const [{ results }, initialPreparation] = await Promise.all([
    database
      .prepare(
        `SELECT ${PLUGIN_SERVER_COLUMNS} FROM user_plugin_servers WHERE user_id = ?1 LIMIT ?2`
      )
      .bind(userId, CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT + 1)
      .all<PluginServerRow>(),
    ensureStorageLedger(database, userId, input.now),
  ])

  let preparation = initialPreparation
  const cleanupStatements: D1PreparedStatement[] = []
  const activeRows: PluginServerRow[] = []
  for (const row of results) {
    if (
      row.credential_status !== "ready" &&
      row.pending_expires_at !== null &&
      row.pending_expires_at <= input.now
    ) {
      const ledgerMutation = applyStorageMutation(
        database,
        preparation,
        {
          domain: "pluginServerBytes",
          currentBytes: byteLength(row),
          nextBytes: 0,
          savedLinkCountDelta: 0,
        },
        input.now
      )
      cleanupStatements.push(...ledgerMutation.statements)
      cleanupStatements.push(
        database
          .prepare("DELETE FROM user_plugin_servers WHERE id = ?1")
          .bind(row.id)
      )
      preparation = withAppliedMutation(preparation, ledgerMutation)
    } else {
      activeRows.push(row)
    }
  }

  const existing = activeRows.find(
    (row) => row.normalized_base_url === normalizedBaseUrl
  )
  if (existing?.credential_status === "ready") {
    throw new Error("This Plugin Server is already registered.")
  }
  if (existing) {
    const generation = (existing.credential_generation ?? 0) + 1
    const nextRow: PluginServerRow = {
      ...existing,
      base_url: normalizedBaseUrl,
      credential_status: "pending",
      pending_expires_at: pendingExpiresAt,
      failure_reason: null,
      credential_generation: generation,
      credential_attempt_id: attemptId,
      updated_at: input.now,
    }
    const mutation = buildServerMutationStatements(
      database,
      preparation,
      existing.id,
      [
        "base_url",
        "credential_status",
        "pending_expires_at",
        "failure_reason",
        "credential_generation",
        "credential_attempt_id",
      ],
      existing,
      nextRow,
      input.now
    )
    const { dataVersion } = await executeOwnedWrite(database, userId, [
      ...preparation.statements,
      ...cleanupStatements,
      ...mutation,
    ])
    return {
      id: existing.id,
      resumed: true,
      generation,
      attemptId,
      dataVersion,
    }
  }
  if (activeRows.length >= CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT) {
    throw new Error("You have reached the saved plugin server limit.")
  }
  const newRow: PluginServerRow = {
    id: createOpaqueId(),
    user_id: userId,
    base_url: normalizedBaseUrl,
    normalized_base_url: normalizedBaseUrl,
    api_key_ciphertext: null,
    api_key_nonce: null,
    api_key_algorithm: null,
    api_key_version: null,
    proxy_token_ciphertext: null,
    proxy_token_nonce: null,
    proxy_token_algorithm: null,
    proxy_token_version: null,
    proxy_balance_remaining: null,
    proxy_balance_limit: null,
    proxy_balance_checked_at: null,
    credential_status: "pending",
    credential_generation: 1,
    credential_attempt_id: attemptId,
    pending_expires_at: pendingExpiresAt,
    failure_reason: null,
    manifest: "",
    enabled: 1,
    priority: 0,
    verification_status: "pending",
    last_verified_at: null,
    last_manifest_refresh_at: null,
    created_at: input.now,
    updated_at: input.now,
  }
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "pluginServerBytes",
      currentBytes: 0,
      nextBytes: byteLength(newRow),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...cleanupStatements,
    database
      .prepare(
        "INSERT INTO user_plugin_servers (id, user_id, base_url, normalized_base_url, api_key_ciphertext, api_key_nonce, api_key_algorithm, api_key_version, credential_status, credential_generation, credential_attempt_id, pending_expires_at, failure_reason, manifest, enabled, priority, verification_status, last_verified_at, last_manifest_refresh_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)"
      )
      .bind(
        newRow.id,
        newRow.user_id,
        newRow.base_url,
        newRow.normalized_base_url,
        newRow.api_key_ciphertext,
        newRow.api_key_nonce,
        newRow.api_key_algorithm,
        newRow.api_key_version,
        newRow.credential_status,
        newRow.credential_generation,
        newRow.credential_attempt_id,
        newRow.pending_expires_at,
        newRow.failure_reason,
        newRow.manifest,
        newRow.enabled,
        newRow.priority,
        newRow.verification_status,
        newRow.last_verified_at,
        newRow.last_manifest_refresh_at,
        newRow.created_at,
        newRow.updated_at
      ),
    ...ledgerMutation.statements,
  ])
  return {
    id: newRow.id,
    resumed: false,
    generation: 1,
    attemptId,
    dataVersion,
  }
}

export interface FinalizeCredentialInput {
  id: string
  apiKeyCiphertext: string
  apiKeyNonce: string
  apiKeyAlgorithm: "AES-256-GCM"
  apiKeyVersion: number
  manifest: string
  generation: number
  attemptId: string
}

export const finalizePluginServerCredential = async (
  database: D1Database,
  userId: string,
  input: FinalizeCredentialInput & { now: number }
): Promise<{ success: boolean; dataVersion: number }> => {
  const existing = await findPluginServerRow(database, input.id)
  if (!existing || existing.user_id !== userId) {
    throw new Error("Plugin server credential cannot be finalized")
  }
  if (
    existing.credential_generation !== input.generation ||
    existing.credential_attempt_id !== input.attemptId
  ) {
    throw new Error("Plugin server registration was superseded")
  }
  if (existing.credential_status === "ready") {
    return {
      success: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  if (existing.credential_status !== "pending") {
    throw new Error("Plugin server registration must be resumed")
  }
  const nextRow: PluginServerRow = {
    ...existing,
    api_key_ciphertext: input.apiKeyCiphertext,
    api_key_nonce: input.apiKeyNonce,
    api_key_algorithm: input.apiKeyAlgorithm,
    api_key_version: input.apiKeyVersion,
    credential_status: "ready",
    manifest: input.manifest,
    verification_status: "verified",
    pending_expires_at: null,
    failure_reason: null,
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const mutation = buildServerMutationStatements(
    database,
    preparation,
    existing.id,
    [
      "api_key_ciphertext",
      "api_key_nonce",
      "api_key_algorithm",
      "api_key_version",
      "credential_status",
      "manifest",
      "verification_status",
      "pending_expires_at",
      "failure_reason",
    ],
    existing,
    nextRow,
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...mutation,
  ])
  return { success: true, dataVersion }
}

export const markPluginServerRegistrationFailed = async (
  database: D1Database,
  userId: string,
  input: {
    id: string
    reason: string
    generation: number
    attemptId: string
    now: number
  }
): Promise<{ success: boolean; dataVersion: number }> => {
  const existing = await findPluginServerRow(database, input.id)
  if (!existing || existing.user_id !== userId) {
    throw new Error("Plugin server registration not found")
  }
  if (
    existing.credential_status !== "pending" ||
    existing.credential_generation !== input.generation ||
    existing.credential_attempt_id !== input.attemptId
  ) {
    throw new Error("Plugin server registration was superseded")
  }
  const nextRow: PluginServerRow = {
    ...existing,
    credential_status: "failed",
    failure_reason: input.reason,
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const mutation = buildServerMutationStatements(
    database,
    preparation,
    existing.id,
    ["credential_status", "failure_reason"],
    existing,
    nextRow,
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...mutation,
  ])
  return { success: true, dataVersion }
}

export const expireStalePluginServerRegistrations = async (
  database: D1Database,
  now: number
): Promise<{ expired: number }> => {
  const { results } = await database
    .prepare(
      `SELECT ${PLUGIN_SERVER_COLUMNS} FROM user_plugin_servers WHERE credential_status != 'ready' AND pending_expires_at IS NOT NULL AND pending_expires_at <= ?1 LIMIT ?2`
    )
    .bind(now, PLUGIN_SERVER_REGISTRATION_SWEEP_BATCH_SIZE)
    .all<PluginServerRow>()
  if (results.length === 0) {
    return { expired: 0 }
  }
  const statements: D1PreparedStatement[] = []
  const affectedUserIds = new Set<string>()
  const preparationsByUserId = new Map(
    await Promise.all(
      [...new Set(results.map((row) => row.user_id))].map(
        async (userId) =>
          [userId, await ensureStorageLedger(database, userId, now)] as const
      )
    )
  )
  for (const row of results) {
    const preparation = preparationsByUserId.get(row.user_id)
    if (!preparation) {
      throw new Error("Storage ledger preparation is missing")
    }
    statements.push(...preparation.statements)
    const ledgerMutation = applyStorageMutation(
      database,
      preparation,
      {
        domain: "pluginServerBytes",
        currentBytes: byteLength(row),
        nextBytes: 0,
        savedLinkCountDelta: 0,
      },
      now
    )
    statements.push(
      ...ledgerMutation.statements,
      database
        .prepare("DELETE FROM user_plugin_servers WHERE id = ?1")
        .bind(row.id)
    )
    affectedUserIds.add(row.user_id)
  }
  for (const affectedUserId of affectedUserIds) {
    statements.push(createDataVersionBumpStatement(database, affectedUserId))
  }
  await database.batch(statements)
  return { expired: results.length }
}

const requireReadyPluginServerRow = async (
  database: D1Database,
  userId: string,
  pluginServerId: string
): Promise<PluginServerRow> => {
  const existing = await requireOwnedPluginServerRow(
    database,
    userId,
    pluginServerId
  )
  if (existing.credential_status !== "ready") {
    throw new Error("Plugin server not found or no longer available")
  }
  return existing
}

export const recordPluginServerVerificationFailure = async (
  database: D1Database,
  userId: string,
  input: { id: string; now: number }
): Promise<{ success: boolean; dataVersion: number }> => {
  const existing = await requireReadyPluginServerRow(database, userId, input.id)
  if (existing.verification_status === "down") {
    return {
      success: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const nextRow: PluginServerRow = {
    ...existing,
    verification_status: "down",
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const mutation = buildServerMutationStatements(
    database,
    preparation,
    existing.id,
    ["verification_status"],
    existing,
    nextRow,
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...mutation,
  ])
  return { success: true, dataVersion }
}

export const recordPluginServerVerificationSuccess = async (
  database: D1Database,
  userId: string,
  input: { id: string; now: number }
): Promise<{ success: boolean; dataVersion: number }> => {
  const existing = await requireReadyPluginServerRow(database, userId, input.id)
  const nextRow: PluginServerRow = {
    ...existing,
    verification_status: "verified",
    last_verified_at: input.now,
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const mutation = buildServerMutationStatements(
    database,
    preparation,
    existing.id,
    ["verification_status", "last_verified_at"],
    existing,
    nextRow,
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...mutation,
  ])
  return { success: true, dataVersion }
}

export const recordPluginServerRefreshSuccess = async (
  database: D1Database,
  userId: string,
  input: { id: string; manifest: string; now: number }
): Promise<{ success: boolean; dataVersion: number }> => {
  const existing = await requireReadyPluginServerRow(database, userId, input.id)
  const nextRow: PluginServerRow = {
    ...existing,
    manifest: input.manifest,
    verification_status: "verified",
    last_verified_at: input.now,
    last_manifest_refresh_at: input.now,
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const mutation = buildServerMutationStatements(
    database,
    preparation,
    existing.id,
    [
      "manifest",
      "verification_status",
      "last_verified_at",
      "last_manifest_refresh_at",
    ],
    existing,
    nextRow,
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...mutation,
  ])
  return { success: true, dataVersion }
}

export const setPluginServerEnabled = async (
  database: D1Database,
  userId: string,
  input: { id: string; enabled: boolean; now: number }
): Promise<{ success: boolean; dataVersion: number }> => {
  const existing = await requireOwnedPluginServerRow(database, userId, input.id)
  if ((existing.enabled === 1) === input.enabled) {
    return {
      success: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const nextRow: PluginServerRow = {
    ...existing,
    enabled: input.enabled ? 1 : 0,
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const mutation = buildServerMutationStatements(
    database,
    preparation,
    existing.id,
    ["enabled"],
    existing,
    nextRow,
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...mutation,
  ])
  return { success: true, dataVersion }
}

export interface PluginServerProxyBalanceUpdate {
  readonly id: string
  readonly balance: {
    readonly remaining: number
    readonly limit: number
  }
  readonly now: number
}

export const updatePluginServerProxyBalance = async (
  database: D1Database,
  userId: string,
  input: PluginServerProxyBalanceUpdate
): Promise<void> => {
  await database
    .prepare(
      "UPDATE user_plugin_servers SET proxy_balance_remaining = ?2, proxy_balance_limit = ?3, proxy_balance_checked_at = ?4 WHERE id = ?1 AND user_id = ?5"
    )
    .bind(
      input.id,
      input.balance.remaining,
      input.balance.limit,
      input.now,
      userId
    )
    .run()
}

export interface PluginServerProxyKeyUpdate {
  readonly id: string
  readonly encrypted: {
    readonly ciphertext: string
    readonly nonce: string
    readonly algorithm: "AES-256-GCM"
    readonly version: number
  } | null
  readonly balance: {
    readonly remaining: number
    readonly limit: number
  } | null
  readonly now: number
}

export const updatePluginServerProxyKey = async (
  database: D1Database,
  userId: string,
  input: PluginServerProxyKeyUpdate
): Promise<{ success: boolean; dataVersion: number }> => {
  const existing = await requireOwnedPluginServerRow(database, userId, input.id)
  const nextRow: PluginServerRow = {
    ...existing,
    proxy_token_ciphertext: input.encrypted?.ciphertext ?? null,
    proxy_token_nonce: input.encrypted?.nonce ?? null,
    proxy_token_algorithm: input.encrypted?.algorithm ?? null,
    proxy_token_version: input.encrypted?.version ?? null,
    proxy_balance_remaining: input.balance?.remaining ?? null,
    proxy_balance_limit: input.balance?.limit ?? null,
    proxy_balance_checked_at: input.balance ? input.now : null,
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const mutation = buildServerMutationStatements(
    database,
    preparation,
    existing.id,
    [
      "proxy_token_ciphertext",
      "proxy_token_nonce",
      "proxy_token_algorithm",
      "proxy_token_version",
      "proxy_balance_remaining",
      "proxy_balance_limit",
      "proxy_balance_checked_at",
    ],
    existing,
    nextRow,
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...mutation,
  ])
  return { success: true, dataVersion }
}

export const deletePluginServerById = async (
  database: D1Database,
  userId: string,
  input: { id: string; now: number }
): Promise<{ success: boolean; dataVersion: number }> => {
  const existing = await requireOwnedPluginServerRow(database, userId, input.id)
  const { results: domainRows } = await database
    .prepare(
      `SELECT ${PLUGIN_DOMAIN_COLUMNS} FROM user_plugin_domains WHERE user_id = ?1 AND plugin_server_id = ?2 LIMIT ?3`
    )
    .bind(userId, existing.id, PLUGIN_SERVER_DEPENDENT_DELETE_LIMIT + 1)
    .all<{
      id: string
      user_id: string
      plugin_server_id: string
      domain: string
      plugin_id: string
      credential_generation: number | null
      credential_attempt_id: string | null
      credential_finalized_attempt_id: string | null
    }>()
  if (domainRows.length > PLUGIN_SERVER_DEPENDENT_DELETE_LIMIT) {
    throw new Error("Plugin server cleanup exceeds the synchronous limit")
  }
  let preparation = await ensureStorageLedger(database, userId, input.now)
  const statements: D1PreparedStatement[] = [...preparation.statements]
  for (const domainRow of domainRows) {
    const deletion = await deletePluginDomainDocument(
      database,
      userId,
      domainRow,
      preparation,
      input.now
    )
    statements.push(...deletion.statements)
    preparation = deletion.preparation
  }
  const serverLedgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "pluginServerBytes",
      currentBytes: byteLength(existing),
      nextBytes: 0,
      savedLinkCountDelta: 0,
    },
    input.now
  )
  statements.push(
    ...serverLedgerMutation.statements,
    database
      .prepare("DELETE FROM user_plugin_servers WHERE id = ?1")
      .bind(existing.id)
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, statements)
  return { success: true, dataVersion }
}
