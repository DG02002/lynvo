import { normalizePluginDomain } from "../../app/lib/plugin-domain"
import { createOpaqueId } from "./ids"
import {
  PLUGIN_CREDENTIAL_COLUMNS,
  PLUGIN_DOMAIN_COLUMNS,
  type PluginCredentialRow,
  type PluginDomainRow,
} from "./rows"
import {
  executeOwnedWrite,
  getDataVersion,
  type OwnedWriteGuard,
} from "./data-version"
import {
  applyStorageMutation,
  byteLength,
  ensureStorageLedger,
  withAppliedMutation,
  type StorageLedgerPreparation,
} from "./storage-ledger"
import { requireReadyPluginServerRow } from "./plugin-server-ownership"

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

const PLUGIN_DOMAIN_UPSERT_GUARD_SQL =
  "SELECT 1 FROM user_plugin_domains WHERE id = ?2 AND user_id = ?1 AND plugin_server_id = ?3 AND domain = ?4 AND plugin_id = ?5 AND credential_generation IS ?6 AND credential_attempt_id IS ?7 AND credential_finalized_attempt_id IS ?8 AND EXISTS (SELECT 1 FROM user_plugin_servers WHERE id = ?3 AND user_id = ?1 AND credential_status = 'ready')"
const PLUGIN_DOMAIN_UPSERT_LEDGER_SQL =
  "SELECT 1 FROM user_plugin_domains WHERE id = ?6 AND user_id = ?1 AND plugin_server_id = ?7 AND domain = ?8 AND plugin_id = ?9 AND credential_generation IS ?10 AND credential_attempt_id IS ?11 AND credential_finalized_attempt_id IS ?12 AND EXISTS (SELECT 1 FROM user_plugin_servers WHERE id = ?7 AND user_id = ?1 AND credential_status = 'ready')"

interface PluginDomainUpsertConditions {
  ledgerCondition: OwnedWriteGuard
  guard: OwnedWriteGuard
}

const pluginDomainUpsertConditions = (
  row: PluginDomainRow
): PluginDomainUpsertConditions => {
  const conditionBindings = [
    row.id,
    row.plugin_server_id,
    row.domain,
    row.plugin_id,
    row.credential_generation,
    row.credential_attempt_id,
    row.credential_finalized_attempt_id,
  ]
  return {
    ledgerCondition: {
      conditionSql: PLUGIN_DOMAIN_UPSERT_LEDGER_SQL,
      conditionBindings,
    },
    guard: {
      conditionSql: PLUGIN_DOMAIN_UPSERT_GUARD_SQL,
      conditionBindings,
    },
  }
}

const findDomainRowById = async (
  database: D1Database,
  domainId: string
): Promise<PluginDomainRow | null> => {
  const row = await database
    .prepare(
      `SELECT ${PLUGIN_DOMAIN_COLUMNS} FROM user_plugin_domains WHERE id = ?1`
    )
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
      `SELECT ${PLUGIN_CREDENTIAL_COLUMNS} FROM user_plugin_credentials WHERE plugin_domain_id = ?1 LIMIT 1`
    )
    .bind(pluginDomainId)
    .first<PluginCredentialRow>()
  return row ?? null
}

interface BuildCredentialDocumentInput {
  readonly userId: string
  readonly domainRow: PluginDomainRow
  readonly credential: EncryptedCredentialInput
  readonly existingCredential: PluginCredentialRow | undefined
  readonly now: number
}

export const buildCredentialDocument = ({
  userId,
  domainRow,
  credential,
  existingCredential,
  now,
}: BuildCredentialDocumentInput): PluginCredentialRow => ({
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

interface BuildReplaceCredentialMutationsInput {
  readonly database: D1Database
  readonly preparation: StorageLedgerPreparation
  readonly userId: string
  readonly domainRow: PluginDomainRow
  readonly credential: EncryptedCredentialInput
  readonly existingCredential: PluginCredentialRow | undefined
  readonly now: number
  readonly condition?: OwnedWriteGuard
  readonly requireReadyPluginServer?: boolean
}

const buildReplaceCredentialMutations = ({
  database,
  preparation,
  userId,
  domainRow,
  credential,
  existingCredential,
  now,
  condition,
  requireReadyPluginServer = false,
}: BuildReplaceCredentialMutationsInput): D1PreparedStatement[] => {
  const credentialDocument = buildCredentialDocument({
    userId,
    domainRow,
    credential,
    existingCredential,
    now,
  })
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "pluginCredentialBytes",
      currentBytes: existingCredential ? byteLength(existingCredential) : 0,
      nextBytes: byteLength(credentialDocument),
      savedLinkCountDelta: 0,
    },
    now,
    condition,
  })
  const credentialBindings = [
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
    credentialDocument.updated_at,
  ]
  const credentialInsertSource = requireReadyPluginServer
    ? `SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
       WHERE EXISTS (
         SELECT 1 FROM user_plugin_domains
         WHERE id = ?3
           AND user_id = ?2
           AND plugin_server_id = ?13
           AND domain = ?6
           AND plugin_id = ?5
       )
       AND EXISTS (
         SELECT 1 FROM user_plugin_servers
         WHERE id = ?13
           AND user_id = ?2
           AND credential_status = 'ready'
       )`
    : "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
  const writeStatement = database
    .prepare(
      `INSERT INTO user_plugin_credentials (id, user_id, plugin_domain_id, plugin_server_id, plugin_id, domain, ciphertext, nonce, algorithm, key_version, created_at, updated_at) ${credentialInsertSource} ON CONFLICT(plugin_domain_id) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, algorithm = excluded.algorithm, key_version = excluded.key_version, updated_at = excluded.updated_at`
    )
    .bind(
      ...credentialBindings,
      ...(requireReadyPluginServer ? [domainRow.plugin_server_id] : [])
    )
  return [...ledgerMutation.statements, writeStatement]
}

interface BuildDeleteCredentialMutationsInput {
  readonly database: D1Database
  readonly preparation: StorageLedgerPreparation
  readonly existingCredential: PluginCredentialRow
  readonly now: number
  readonly condition?: OwnedWriteGuard
}

const buildDeleteCredentialMutations = ({
  database,
  preparation,
  existingCredential,
  now,
  condition,
}: BuildDeleteCredentialMutationsInput): D1PreparedStatement[] => {
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "pluginCredentialBytes",
      currentBytes: byteLength(existingCredential),
      nextBytes: 0,
      savedLinkCountDelta: 0,
    },
    now,
    condition,
  })
  return [
    ...ledgerMutation.statements,
    database
      .prepare(
        "DELETE FROM user_plugin_credentials WHERE id = ?1 AND user_id = ?2 AND EXISTS (SELECT 1 FROM user_plugin_servers WHERE id = ?3 AND user_id = ?2 AND credential_status = 'ready')"
      )
      .bind(
        existingCredential.id,
        existingCredential.user_id,
        existingCredential.plugin_server_id
      ),
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
      .prepare(
        `SELECT ${PLUGIN_DOMAIN_COLUMNS} FROM user_plugin_domains WHERE user_id = ?1`
      )
      .bind(userId)
      .all<PluginDomainRow>(),
    database
      .prepare(
        `SELECT ${PLUGIN_CREDENTIAL_COLUMNS} FROM user_plugin_credentials WHERE user_id = ?1`
      )
      .bind(userId)
      .all<{ plugin_domain_id: string }>(),
  ])
  const credentialDomainIds = new Set(
    credentialRows.results.map((row) => row.plugin_domain_id)
  )
  return domainRows.results.map((row) =>
    Object.assign({}, mapDomainRow(row), {
      hasCredential: credentialDomainIds.has(row.id),
    })
  )
}

export const getPluginDomainByDomain = async (
  database: D1Database,
  userId: string,
  input: { domain: string; pluginServerId: string }
): Promise<PluginDomainRecord | null> => {
  const row = await database
    .prepare(
      `SELECT ${PLUGIN_DOMAIN_COLUMNS} FROM user_plugin_domains WHERE user_id = ?1 AND plugin_server_id = ?2 AND domain = ?3`
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
      `SELECT ${PLUGIN_CREDENTIAL_COLUMNS} FROM user_plugin_credentials WHERE user_id = ?1 AND plugin_server_id = ?2 AND domain = ?3 LIMIT 1`
    )
    .bind(userId, input.pluginServerId, normalizePluginDomain(input.domain))
    .first<PluginCredentialRow>()
  return row ? mapCredentialRow(row) : null
}

export interface UpsertPluginDomainResult {
  id: string
  dataVersion: number
}

interface PluginDomainUpsertInput {
  domain: string
  pluginServerId: string
  pluginId: string
  credential?: EncryptedCredentialInput | undefined
  now: number
}

interface InsertNewPluginDomainInput {
  database: D1Database
  userId: string
  domain: string
  input: PluginDomainUpsertInput
}

const insertNewPluginDomain = async ({
  database,
  userId,
  domain,
  input,
}: InsertNewPluginDomainInput): Promise<UpsertPluginDomainResult> => {
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
  const applied = pluginDomainUpsertConditions(domainRow)
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const domainLedgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "pluginDomainBytes",
      currentBytes: 0,
      nextBytes: byteLength(domainRow),
      savedLinkCountDelta: 0,
    },
    now: input.now,
    condition: applied.ledgerCondition,
  })
  let statements: D1PreparedStatement[] = [
    ...preparation.statements,
    database
      .prepare(
        "INSERT INTO user_plugin_domains (id, user_id, plugin_server_id, domain, plugin_id, credential_generation, credential_attempt_id, credential_finalized_attempt_id) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE EXISTS (SELECT 1 FROM user_plugin_servers WHERE id = ?3 AND user_id = ?2 AND credential_status = 'ready')"
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
    const credentialMutations = buildReplaceCredentialMutations({
      database,
      preparation,
      userId,
      domainRow,
      credential: input.credential,
      existingCredential: undefined,
      now: input.now,
      condition: applied.ledgerCondition,
      requireReadyPluginServer: true,
    })
    statements = [...statements, ...credentialMutations]
  }
  const { dataVersion, changed } = await executeOwnedWrite({
    database,
    userId,
    statements,
    guard: applied.guard,
  })
  if (!changed) {
    throw new Error("Plugin server not found or no longer available")
  }
  return { id: domainRow.id, dataVersion }
}

interface UpdateExistingPluginDomainInput {
  database: D1Database
  userId: string
  domain: string
  existingDomainRow: PluginDomainRow
  input: PluginDomainUpsertInput
}

const updateExistingPluginDomain = async ({
  database,
  userId,
  domain,
  existingDomainRow,
  input,
}: UpdateExistingPluginDomainInput): Promise<UpsertPluginDomainResult> => {
  const existingCredential = await findCredentialByDomainId(
    database,
    existingDomainRow.id
  )
  const isReassignment = existingDomainRow.plugin_id !== input.pluginId
  const nextDomainRow: PluginDomainRow = {
    ...existingDomainRow,
    plugin_id: input.pluginId,
    domain,
    credential_generation: isReassignment
      ? (existingDomainRow.credential_generation ?? 0) + 1
      : existingDomainRow.credential_generation,
    credential_attempt_id: null,
    credential_finalized_attempt_id: null,
  }
  const applied = pluginDomainUpsertConditions(nextDomainRow)
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const domainLedgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(existingDomainRow),
      nextBytes: byteLength(nextDomainRow),
      savedLinkCountDelta: 0,
    },
    now: input.now,
    condition: applied.ledgerCondition,
  })
  let statements: D1PreparedStatement[] = [
    ...preparation.statements,
    database
      .prepare(
        "UPDATE user_plugin_domains SET plugin_id = ?4, domain = ?5, credential_generation = ?6, credential_attempt_id = ?7, credential_finalized_attempt_id = ?8 WHERE id = ?1 AND user_id = ?2 AND plugin_server_id = ?3 AND EXISTS (SELECT 1 FROM user_plugin_servers WHERE id = ?3 AND user_id = ?2 AND credential_status = 'ready')"
      )
      .bind(
        existingDomainRow.id,
        userId,
        nextDomainRow.plugin_server_id,
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
      ...buildDeleteCredentialMutations({
        database,
        preparation,
        existingCredential,
        now: input.now,
        condition: applied.ledgerCondition,
      })
    )
  }
  if (input.credential) {
    const credentialMutations = buildReplaceCredentialMutations({
      database,
      preparation,
      userId,
      domainRow: nextDomainRow,
      credential: input.credential,
      existingCredential: isReassignment
        ? undefined
        : (existingCredential ?? undefined),
      now: input.now,
      condition: applied.ledgerCondition,
      requireReadyPluginServer: true,
    })
    statements = [...statements, ...credentialMutations]
  }
  const { dataVersion, changed } = await executeOwnedWrite({
    database,
    userId,
    statements,
    guard: applied.guard,
  })
  if (!changed) {
    throw new Error("Plugin server not found or no longer available")
  }
  return { id: existingDomainRow.id, dataVersion }
}

const upsertPluginDomainOnce = async (
  database: D1Database,
  userId: string,
  input: PluginDomainUpsertInput
): Promise<UpsertPluginDomainResult> => {
  const pluginServer = await requireReadyPluginServerRow(
    database,
    userId,
    input.pluginServerId
  )
  const ownedInput = { ...input, pluginServerId: pluginServer.id }
  const domain = normalizePluginDomain(input.domain)
  const existingDomainRow = await database
    .prepare(
      `SELECT ${PLUGIN_DOMAIN_COLUMNS} FROM user_plugin_domains WHERE user_id = ?1 AND plugin_server_id = ?2 AND domain = ?3`
    )
    .bind(userId, pluginServer.id, domain)
    .first<PluginDomainRow>()

  if (!existingDomainRow) {
    return insertNewPluginDomain({
      database,
      userId,
      domain,
      input: ownedInput,
    })
  }
  return updateExistingPluginDomain({
    database,
    userId,
    domain,
    existingDomainRow,
    input: ownedInput,
  })
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

interface BuildSetCredentialStatementsInput {
  readonly database: D1Database
  readonly userId: string
  readonly domainRow: PluginDomainRow
  readonly credential: EncryptedCredentialInput
  readonly now: number
}

const buildSetCredentialStatements = async ({
  database,
  userId,
  domainRow,
  credential,
  now,
}: BuildSetCredentialStatementsInput): Promise<D1PreparedStatement[]> => {
  const [existingCredential, preparation] = await Promise.all([
    findCredentialByDomainId(database, domainRow.id),
    ensureStorageLedger(database, userId, now),
  ])
  const credentialMutations = buildReplaceCredentialMutations({
    database,
    preparation,
    userId,
    domainRow,
    credential,
    existingCredential: existingCredential ?? undefined,
    now,
  })
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
  const statements = await buildSetCredentialStatements({
    database,
    userId,
    domainRow,
    credential: input.credential,
    now: input.now,
  })
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements,
  })
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
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(domainRow),
      nextBytes: byteLength(nextRow),
      savedLinkCountDelta: 0,
    },
    now: input.now,
  })
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      ...ledgerMutation.statements,
      database
        .prepare(
          "UPDATE user_plugin_domains SET credential_generation = ?3, credential_attempt_id = ?4, credential_finalized_attempt_id = NULL WHERE id = ?1 AND user_id = ?2"
        )
        .bind(domainRow.id, userId, generation, attemptId),
    ],
  })
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
      buildSetCredentialStatements({
        database,
        userId,
        domainRow,
        credential: input.credential,
        now: input.now,
      }),
      ensureStorageLedger(database, userId, input.now),
    ])
  const finalizedRow = {
    ...domainRow,
    credential_finalized_attempt_id: input.attemptId,
  }
  const finalizationLedgerMutation = applyStorageMutation({
    database,
    preparation: finalizationPreparation,
    plan: {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(domainRow),
      nextBytes: byteLength(finalizedRow),
      savedLinkCountDelta: 0,
    },
    now: input.now,
  })
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparedCredentialStatements,
      ...finalizationPreparation.statements,
      ...finalizationLedgerMutation.statements,
      database
        .prepare(
          "UPDATE user_plugin_domains SET credential_finalized_attempt_id = ?3 WHERE id = ?1 AND user_id = ?2"
        )
        .bind(domainRow.id, userId, input.attemptId),
    ],
  })
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
  const revocationLedgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(domainRow),
      nextBytes: byteLength(revokedRow),
      savedLinkCountDelta: 0,
    },
    now: input.now,
  })
  const statements: D1PreparedStatement[] = [
    ...preparation.statements,
    ...revocationLedgerMutation.statements,
    database
      .prepare(
        "UPDATE user_plugin_domains SET credential_generation = ?3, credential_attempt_id = NULL, credential_finalized_attempt_id = NULL WHERE id = ?1 AND user_id = ?2"
      )
      .bind(domainRow.id, userId, revokedRow.credential_generation),
  ]
  if (existingCredential) {
    const credentialLedgerMutation = applyStorageMutation({
      database,
      preparation: withAppliedMutation(preparation, revocationLedgerMutation),
      plan: {
        domain: "pluginCredentialBytes",
        currentBytes: byteLength(existingCredential),
        nextBytes: 0,
        savedLinkCountDelta: 0,
      },
      now: input.now,
    })
    statements.push(
      ...credentialLedgerMutation.statements,
      database
        .prepare("DELETE FROM user_plugin_credentials WHERE id = ?1")
        .bind(existingCredential.id)
    )
  }
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements,
  })
  return dataVersion
}

export interface PluginDomainDeletion {
  statements: D1PreparedStatement[]
  preparation: StorageLedgerPreparation
}

export interface PluginDomainDeletionInput {
  domainRow: PluginDomainRow
  existingCredential: PluginCredentialRow | undefined
  preparation: StorageLedgerPreparation
  now: number
}

export const buildPluginDomainDeletion = (
  database: D1Database,
  input: PluginDomainDeletionInput
): PluginDomainDeletion => {
  const { domainRow, existingCredential, now } = input
  const statements: D1PreparedStatement[] = []
  let chainedPreparation = input.preparation
  if (existingCredential) {
    const credentialLedgerMutation = applyStorageMutation({
      database,
      preparation: chainedPreparation,
      plan: {
        domain: "pluginCredentialBytes",
        currentBytes: byteLength(existingCredential),
        nextBytes: 0,
        savedLinkCountDelta: 0,
      },
      now,
    })
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
  const domainLedgerMutation = applyStorageMutation({
    database,
    preparation: chainedPreparation,
    plan: {
      domain: "pluginDomainBytes",
      currentBytes: byteLength(domainRow),
      nextBytes: 0,
      savedLinkCountDelta: 0,
    },
    now,
  })
  statements.push(
    ...domainLedgerMutation.statements,
    database
      .prepare("DELETE FROM user_plugin_domains WHERE id = ?1 AND user_id = ?2")
      .bind(domainRow.id, domainRow.user_id)
  )
  return {
    statements,
    preparation: withAppliedMutation(chainedPreparation, domainLedgerMutation),
  }
}

interface DeletePluginDomainDocumentInput {
  readonly database: D1Database
  readonly domainRow: PluginDomainRow
  readonly preparation: StorageLedgerPreparation
  readonly now: number
}

const deletePluginDomainDocument = async ({
  database,
  domainRow,
  preparation,
  now,
}: DeletePluginDomainDocumentInput): Promise<PluginDomainDeletion> => {
  const existingCredential =
    (await findCredentialByDomainId(database, domainRow.id)) ?? undefined
  return buildPluginDomainDeletion(database, {
    domainRow,
    existingCredential,
    preparation,
    now,
  })
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
  const deletion = await deletePluginDomainDocument({
    database,
    domainRow,
    preparation,
    now: input.now,
  })
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements: deletion.statements,
  })
  return dataVersion
}
