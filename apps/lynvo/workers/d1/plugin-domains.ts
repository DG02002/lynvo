import { normalizePluginDomain } from "../../app/lib/plugin-domain"
import { createOpaqueId } from "./ids"
import type { PluginCredentialRow, PluginDomainRow } from "./rows"
import { executeOwnedWrite, getDataVersion } from "./data-version"
import {
  applyStorageMutation,
  byteLength,
  ensureStorageLedger,
  withAppliedMutation,
  type StorageLedgerPreparation,
} from "./storage-ledger"

export interface EncryptedCredentialInput {
  ciphertext: string
  nonce: string
  algorithm: "AES-256-GCM"
  keyVersion: number
}

export interface PluginDomainRecord {
  id: string
  userId: string
  pluginServerId: string
  domain: string
  pluginId: string
  credentialGeneration: number | null
  credentialAttemptId: string | null
  credentialFinalizedAttemptId: string | null
}

export interface PluginCredentialRecord {
  id: string
  userId: string
  pluginDomainId: string
  pluginServerId: string
  pluginId: string
  domain: string
  ciphertext: string
  nonce: string
  algorithm: "AES-256-GCM"
  keyVersion: number
  createdAt: number
  updatedAt: number
}

const mapDomainRow = (row: PluginDomainRow): PluginDomainRecord => ({
  id: row.id,
  userId: row.user_id,
  pluginServerId: row.plugin_server_id,
  domain: row.domain,
  pluginId: row.plugin_id,
  credentialGeneration: row.credential_generation,
  credentialAttemptId: row.credential_attempt_id,
  credentialFinalizedAttemptId: row.credential_finalized_attempt_id,
})

const mapCredentialRow = (
  row: PluginCredentialRow
): PluginCredentialRecord => ({
  id: row.id,
  userId: row.user_id,
  pluginDomainId: row.plugin_domain_id,
  pluginServerId: row.plugin_server_id,
  pluginId: row.plugin_id,
  domain: row.domain,
  ciphertext: row.ciphertext,
  nonce: row.nonce,
  algorithm: row.algorithm,
  keyVersion: row.key_version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const findDomainRowById = async (
  database: D1Database,
  domainId: string
): Promise<PluginDomainRow | null> => {
  const row = await database
    .prepare("SELECT * FROM user_plugin_domains WHERE id = ?1")
    .bind(domainId)
    .first<PluginDomainRow>()
  return row ?? null
}

const requireAuthorizedDomainRow = async (
  database: D1Database,
  userId: string,
  domainId: string
): Promise<PluginDomainRow> => {
  const domain = await findDomainRowById(database, domainId)
  if (!domain || domain.user_id !== userId) {
    throw new Error("Plugin domain not found")
  }
  return domain
}

const findCredentialByDomainId = async (
  database: D1Database,
  pluginDomainId: string
): Promise<PluginCredentialRow | null> => {
  const row = await database
    .prepare(
      "SELECT * FROM user_plugin_credentials WHERE plugin_domain_id = ?1 LIMIT 1"
    )
    .bind(pluginDomainId)
    .first<PluginCredentialRow>()
  return row ?? null
}

export const buildCredentialDocument = (
  userId: string,
  domainRow: PluginDomainRow,
  credential: EncryptedCredentialInput,
  existingCredential: PluginCredentialRow | undefined,
  now: number
): PluginCredentialRow => ({
  id: existingCredential?.id ?? createOpaqueId(),
  user_id: userId,
  plugin_domain_id: domainRow.id,
  plugin_server_id: domainRow.plugin_server_id,
  plugin_id: domainRow.plugin_id,
  domain: domainRow.domain,
  ciphertext: credential.ciphertext,
  nonce: credential.nonce,
  algorithm: credential.algorithm,
  key_version: credential.keyVersion,
  created_at: existingCredential?.created_at ?? now,
  updated_at: now,
})

const buildReplaceCredentialMutations = (
  database: D1Database,
  preparation: StorageLedgerPreparation,
  userId: string,
  domainRow: PluginDomainRow,
  credential: EncryptedCredentialInput,
  existingCredential: PluginCredentialRow | undefined,
  now: number
): D1PreparedStatement[] => {
  const credentialDocument = buildCredentialDocument(
    userId,
    domainRow,
    credential,
    existingCredential,
    now
  )
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "pluginCredentialBytes",
      currentBytes: existingCredential ? byteLength(existingCredential) : 0,
      nextBytes: byteLength(credentialDocument),
      savedLinkCountDelta: 0,
    },
    now
  )
  const writeStatement = database
    .prepare(
      "INSERT INTO user_plugin_credentials (id, user_id, plugin_domain_id, plugin_server_id, plugin_id, domain, ciphertext, nonce, algorithm, key_version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) ON CONFLICT(plugin_domain_id) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, algorithm = excluded.algorithm, key_version = excluded.key_version, updated_at = excluded.updated_at"
    )
    .bind(
      credentialDocument.id,
      credentialDocument.user_id,
      credentialDocument.plugin_domain_id,
      credentialDocument.plugin_server_id,
      credentialDocument.plugin_id,
      credentialDocument.domain,
      credentialDocument.ciphertext,
      credentialDocument.nonce,
      credentialDocument.algorithm,
      credentialDocument.key_version,
      credentialDocument.created_at,
      credentialDocument.updated_at
    )
  return [...ledgerMutation.statements, writeStatement]
}

const buildDeleteCredentialMutations = (
  database: D1Database,
  preparation: StorageLedgerPreparation,
  existingCredential: PluginCredentialRow,
  now: number
): D1PreparedStatement[] => {
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "pluginCredentialBytes",
      currentBytes: byteLength(existingCredential),
      nextBytes: 0,
      savedLinkCountDelta: 0,
    },
    now
  )
  return [
    ...ledgerMutation.statements,
    database
      .prepare("DELETE FROM user_plugin_credentials WHERE id = ?1")
      .bind(existingCredential.id),
  ]
}

export interface PluginDomainListEntry extends PluginDomainRecord {
  hasCredential: boolean
}

export const listPluginDomains = async (
  database: D1Database,
  userId: string
): Promise<PluginDomainListEntry[]> => {
  const [domainRows, credentialRows] = await Promise.all([
    database
      .prepare("SELECT * FROM user_plugin_domains WHERE user_id = ?1")
      .bind(userId)
      .all<PluginDomainRow>(),
    database
      .prepare("SELECT * FROM user_plugin_credentials WHERE user_id = ?1")
      .bind(userId)
      .all<{ plugin_domain_id: string }>(),
  ])
  const credentialDomainIds = new Set(
    credentialRows.results.map((row) => row.plugin_domain_id)
  )
  return domainRows.results.map((row) => ({
    ...mapDomainRow(row),
    hasCredential: credentialDomainIds.has(row.id),
  }))
}

export const getPluginDomainByDomain = async (
  database: D1Database,
  userId: string,
  input: { domain: string; pluginServerId: string }
): Promise<PluginDomainRecord | null> => {
  const row = await database
    .prepare(
      "SELECT * FROM user_plugin_domains WHERE user_id = ?1 AND plugin_server_id = ?2 AND domain = ?3"
    )
    .bind(userId, input.pluginServerId, normalizePluginDomain(input.domain))
    .first<PluginDomainRow>()
  return row ? mapDomainRow(row) : null
}

export const getPluginCredentialByDomainForService = async (
  database: D1Database,
  userId: string,
  input: { domain: string; pluginServerId: string }
): Promise<PluginCredentialRecord | null> => {
  const row = await database
    .prepare(
      "SELECT * FROM user_plugin_credentials WHERE user_id = ?1 AND plugin_server_id = ?2 AND domain = ?3 LIMIT 1"
    )
    .bind(userId, input.pluginServerId, normalizePluginDomain(input.domain))
    .first<PluginCredentialRow>()
  return row ? mapCredentialRow(row) : null
}

export interface UpsertPluginDomainResult {
  id: string
  dataVersion: number
}

const upsertPluginDomainOnce = async (
  database: D1Database,
  userId: string,
  input: {
    domain: string
    pluginServerId: string
    pluginId: string
    credential?: EncryptedCredentialInput | undefined
    now: number
  }
): Promise<UpsertPluginDomainResult> => {
  const domain = normalizePluginDomain(input.domain)
  const existingDomainRow = await database
    .prepare(
      "SELECT * FROM user_plugin_domains WHERE user_id = ?1 AND plugin_server_id = ?2 AND domain = ?3"
    )
    .bind(userId, input.pluginServerId, domain)
    .first<PluginDomainRow>()

  if (!existingDomainRow) {
    const domainRow: PluginDomainRow = {
      id: createOpaqueId(),
      user_id: userId,
      plugin_server_id: input.pluginServerId,
      domain,
      plugin_id: input.pluginId,
      credential_generation: input.credential ? 1 : 0,
      credential_attempt_id: null,
      credential_finalized_attempt_id: null,
    }
    const preparation = await ensureStorageLedger(database, userId, input.now)
    const domainLedgerMutation = applyStorageMutation(
      database,
      preparation,
      {
        domain: "pluginDomainBytes",
        currentBytes: 0,
        nextBytes: byteLength(domainRow),
        savedLinkCountDelta: 0,
      },
      input.now
    )
    let statements: D1PreparedStatement[] = [
      ...preparation.statements,
      database
        .prepare(
          "INSERT INTO user_plugin_domains (id, user_id, plugin_server_id, domain, plugin_id, credential_generation, credential_attempt_id, credential_finalized_attempt_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(
          domainRow.id,
          domainRow.user_id,
          domainRow.plugin_server_id,
          domainRow.domain,
          domainRow.plugin_id,
          domainRow.credential_generation,
          domainRow.credential_attempt_id,
          domainRow.credential_finalized_attempt_id
        ),
      ...domainLedgerMutation.statements,
    ]
    if (input.credential) {
      const credentialMutations = buildReplaceCredentialMutations(
        database,
        preparation,
        userId,
        domainRow,
        input.credential,
        undefined,
        input.now
      )
      statements = [...statements, ...credentialMutations]
    }
    const { dataVersion } = await executeOwnedWrite(
      database,
      userId,
      statements
    )
    return { id: domainRow.id, dataVersion }
  }

  const existingCredential = await findCredentialByDomainId(
    database,
    existingDomainRow.id
  )
  const isReassignment = existingDomainRow.plugin_id !== input.pluginId
  const nextDomainRow = {
    ...existingDomainRow,
    plugin_id: input.pluginId,
    domain,
    credential_generation: isReassignment
      ? (existingDomainRow.credential_generation ?? 0) + 1
      : existingDomainRow.credential_generation,
    credential_attempt_id: null,
    credential_finalized_attempt_id: null,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const domainLedgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(existingDomainRow),
      nextBytes: byteLength(nextDomainRow),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  let statements: D1PreparedStatement[] = [
    ...preparation.statements,
    database
      .prepare(
        "UPDATE user_plugin_domains SET plugin_id = ?2, domain = ?3, credential_generation = ?4, credential_attempt_id = ?5, credential_finalized_attempt_id = ?6 WHERE id = ?1"
      )
      .bind(
        existingDomainRow.id,
        nextDomainRow.plugin_id,
        nextDomainRow.domain,
        nextDomainRow.credential_generation,
        nextDomainRow.credential_attempt_id,
        nextDomainRow.credential_finalized_attempt_id
      ),
    ...domainLedgerMutation.statements,
  ]
  if (isReassignment && existingCredential) {
    statements.push(
      ...buildDeleteCredentialMutations(
        database,
        preparation,
        existingCredential,
        input.now
      )
    )
  }
  if (input.credential) {
    const credentialMutations = buildReplaceCredentialMutations(
      database,
      preparation,
      userId,
      nextDomainRow,
      input.credential,
      isReassignment ? undefined : (existingCredential ?? undefined),
      input.now
    )
    statements = [...statements, ...credentialMutations]
  }
  const { dataVersion } = await executeOwnedWrite(database, userId, statements)
  return { id: existingDomainRow.id, dataVersion }
}

export const upsertPluginDomain = async (
  database: D1Database,
  userId: string,
  input: {
    domain: string
    pluginServerId: string
    pluginId: string
    credential?: EncryptedCredentialInput | undefined
    now: number
  }
): Promise<UpsertPluginDomainResult> => {
  try {
    return await upsertPluginDomainOnce(database, userId, input)
  } catch (error) {
    // SAFETY: D1 surfaces constraint failures as message strings only; a
    // concurrent upsert of the same (user, server, domain) hit the unique
    // index first, so one retry converges on the update branch.
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: user_plugin_domains")
    ) {
      return await upsertPluginDomainOnce(database, userId, input)
    }
    throw error
  }
}

const buildSetCredentialStatements = async (
  database: D1Database,
  userId: string,
  domainRow: PluginDomainRow,
  credential: EncryptedCredentialInput,
  now: number
): Promise<D1PreparedStatement[]> => {
  const [existingCredential, preparation] = await Promise.all([
    findCredentialByDomainId(database, domainRow.id),
    ensureStorageLedger(database, userId, now),
  ])
  const credentialMutations = buildReplaceCredentialMutations(
    database,
    preparation,
    userId,
    domainRow,
    credential,
    existingCredential ?? undefined,
    now
  )
  return [...preparation.statements, ...credentialMutations]
}

export const setPluginDomainCredential = async (
  database: D1Database,
  userId: string,
  input: {
    domainId: string
    credential: EncryptedCredentialInput
    now: number
  }
): Promise<number> => {
  const domainRow = await requireAuthorizedDomainRow(
    database,
    userId,
    input.domainId
  )
  const statements = await buildSetCredentialStatements(
    database,
    userId,
    domainRow,
    input.credential,
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, statements)
  return dataVersion
}

export interface BeginCredentialChangeResult {
  id: string
  userId: string
  pluginServerId: string
  pluginId: string
  domain: string
  generation: number
  attemptId: string
  dataVersion: number
}

export const beginPluginDomainCredentialChange = async (
  database: D1Database,
  userId: string,
  input: { domainId: string; now: number }
): Promise<BeginCredentialChangeResult> => {
  const domainRow = await requireAuthorizedDomainRow(
    database,
    userId,
    input.domainId
  )
  const generation = (domainRow.credential_generation ?? 0) + 1
  const attemptId = crypto.randomUUID()
  const nextRow = {
    ...domainRow,
    credential_generation: generation,
    credential_attempt_id: attemptId,
    credential_finalized_attempt_id: null,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(domainRow),
      nextBytes: byteLength(nextRow),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...ledgerMutation.statements,
    database
      .prepare(
        "UPDATE user_plugin_domains SET credential_generation = ?2, credential_attempt_id = ?3, credential_finalized_attempt_id = NULL WHERE id = ?1"
      )
      .bind(domainRow.id, generation, attemptId),
  ])
  return {
    id: domainRow.id,
    userId: domainRow.user_id,
    pluginServerId: domainRow.plugin_server_id,
    pluginId: domainRow.plugin_id,
    domain: domainRow.domain,
    generation,
    attemptId,
    dataVersion,
  }
}

export const finalizePluginDomainCredentialChange = async (
  database: D1Database,
  userId: string,
  input: {
    domainId: string
    generation: number
    attemptId: string
    credential: EncryptedCredentialInput
    now: number
  }
): Promise<number> => {
  const domainRow = await requireAuthorizedDomainRow(
    database,
    userId,
    input.domainId
  )
  if (
    domainRow.credential_generation !== input.generation ||
    domainRow.credential_attempt_id !== input.attemptId
  ) {
    throw new Error("Plugin credential change was superseded")
  }
  if (domainRow.credential_finalized_attempt_id === input.attemptId) {
    return await getDataVersion(database, userId)
  }
  const [preparedCredentialStatements, finalizationPreparation] =
    await Promise.all([
      buildSetCredentialStatements(
        database,
        userId,
        domainRow,
        input.credential,
        input.now
      ),
      ensureStorageLedger(database, userId, input.now),
    ])
  const finalizedRow = {
    ...domainRow,
    credential_finalized_attempt_id: input.attemptId,
  }
  const finalizationLedgerMutation = applyStorageMutation(
    database,
    finalizationPreparation,
    {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(domainRow),
      nextBytes: byteLength(finalizedRow),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparedCredentialStatements,
    ...finalizationPreparation.statements,
    ...finalizationLedgerMutation.statements,
    database
      .prepare(
        "UPDATE user_plugin_domains SET credential_finalized_attempt_id = ?2 WHERE id = ?1"
      )
      .bind(domainRow.id, input.attemptId),
  ])
  return dataVersion
}

export const deletePluginDomainCredential = async (
  database: D1Database,
  userId: string,
  input: { domainId: string; now: number }
): Promise<number> => {
  const domainRow = await requireAuthorizedDomainRow(
    database,
    userId,
    input.domainId
  )
  const existingCredential = await findCredentialByDomainId(
    database,
    domainRow.id
  )
  const revokedRow = {
    ...domainRow,
    credential_generation: (domainRow.credential_generation ?? 0) + 1,
    credential_attempt_id: null,
    credential_finalized_attempt_id: null,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const revocationLedgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(domainRow),
      nextBytes: byteLength(revokedRow),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  const statements: D1PreparedStatement[] = [
    ...preparation.statements,
    ...revocationLedgerMutation.statements,
    database
      .prepare(
        "UPDATE user_plugin_domains SET credential_generation = ?2, credential_attempt_id = NULL, credential_finalized_attempt_id = NULL WHERE id = ?1"
      )
      .bind(domainRow.id, revokedRow.credential_generation),
  ]
  if (existingCredential) {
    const credentialLedgerMutation = applyStorageMutation(
      database,
      withAppliedMutation(preparation, revocationLedgerMutation),
      {
        domain: "pluginCredentialBytes",
        currentBytes: byteLength(existingCredential),
        nextBytes: 0,
        savedLinkCountDelta: 0,
      },
      input.now
    )
    statements.push(
      ...credentialLedgerMutation.statements,
      database
        .prepare("DELETE FROM user_plugin_credentials WHERE id = ?1")
        .bind(existingCredential.id)
    )
  }
  const { dataVersion } = await executeOwnedWrite(database, userId, statements)
  return dataVersion
}

export interface PluginDomainDeletion {
  statements: D1PreparedStatement[]
  preparation: StorageLedgerPreparation
}

export const deletePluginDomainDocument = async (
  database: D1Database,
  userId: string,
  domainRow: PluginDomainRow,
  preparation: StorageLedgerPreparation,
  now: number
): Promise<PluginDomainDeletion> => {
  const existingCredential = await findCredentialByDomainId(
    database,
    domainRow.id
  )
  const statements: D1PreparedStatement[] = []
  let chainedPreparation = preparation
  if (existingCredential) {
    const credentialLedgerMutation = applyStorageMutation(
      database,
      chainedPreparation,
      {
        domain: "pluginCredentialBytes",
        currentBytes: byteLength(existingCredential),
        nextBytes: 0,
        savedLinkCountDelta: 0,
      },
      now
    )
    statements.push(
      ...credentialLedgerMutation.statements,
      database
        .prepare("DELETE FROM user_plugin_credentials WHERE id = ?1")
        .bind(existingCredential.id)
    )
    chainedPreparation = withAppliedMutation(
      chainedPreparation,
      credentialLedgerMutation
    )
  }
  const domainLedgerMutation = applyStorageMutation(
    database,
    chainedPreparation,
    {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(domainRow),
      nextBytes: 0,
      savedLinkCountDelta: 0,
    },
    now
  )
  statements.push(
    ...domainLedgerMutation.statements,
    database
      .prepare("DELETE FROM user_plugin_domains WHERE id = ?1")
      .bind(domainRow.id)
  )
  return {
    statements,
    preparation: withAppliedMutation(chainedPreparation, domainLedgerMutation),
  }
}

export const deletePluginDomainById = async (
  database: D1Database,
  userId: string,
  input: { domainId: string; now: number }
): Promise<number> => {
  const domainRow = await requireAuthorizedDomainRow(
    database,
    userId,
    input.domainId
  )
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const deletion = await deletePluginDomainDocument(
    database,
    userId,
    domainRow,
    preparation,
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(
    database,
    userId,
    deletion.statements
  )
  return dataVersion
}
