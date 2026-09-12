import { normalizePluginDomain } from "../../app/lib/plugin-domain"
import { createOpaqueId } from "./ids"
import {
  PLUGIN_CREDENTIAL_COLUMNS,
  PLUGIN_DOMAIN_COLUMNS,
  type PluginCredentialRow,
  type PluginDomainRow,
} from "./rows"
import {
  createChangedWriteGuard,
  executeOwnedWrite,
  getDataVersion,
  type OwnedWriteGuard,
} from "./data-version"
import {
  PluginCredentialChangeSupersededError,
  PluginDomainNotFoundError,
  PluginServerUnavailableError,
} from "./errors"
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

interface PluginDomainStatePredicatePlaceholders {
  id: string
  userId: string
  pluginServerId: string
  domain: string
  pluginId: string
  credentialGeneration: string
  credentialAttemptId: string
  credentialFinalizedAttemptId: string
}

const createPluginDomainStateUpdatePlaceholders = (
  bindingStart: number
): PluginDomainStatePredicatePlaceholders => ({
  id: `?${bindingStart}`,
  userId: `?${bindingStart + 1}`,
  pluginServerId: `?${bindingStart + 2}`,
  domain: `?${bindingStart + 3}`,
  pluginId: `?${bindingStart + 4}`,
  credentialGeneration: `?${bindingStart + 5}`,
  credentialAttemptId: `?${bindingStart + 6}`,
  credentialFinalizedAttemptId: `?${bindingStart + 7}`,
})

const createPluginDomainStateConditionPlaceholders = (
  stateBindingStart: number,
  userIdBinding: number
): PluginDomainStatePredicatePlaceholders => ({
  id: `?${stateBindingStart}`,
  userId: `?${userIdBinding}`,
  pluginServerId: `?${stateBindingStart + 1}`,
  domain: `?${stateBindingStart + 2}`,
  pluginId: `?${stateBindingStart + 3}`,
  credentialGeneration: `?${stateBindingStart + 4}`,
  credentialAttemptId: `?${stateBindingStart + 5}`,
  credentialFinalizedAttemptId: `?${stateBindingStart + 6}`,
})

const createPluginDomainCredentialInsertPlaceholders = (
  stateBindingStart: number
): PluginDomainStatePredicatePlaceholders => ({
  id: "?3",
  userId: "?2",
  pluginServerId: "?4",
  domain: "?6",
  pluginId: "?5",
  credentialGeneration: `?${stateBindingStart}`,
  credentialAttemptId: `?${stateBindingStart + 1}`,
  credentialFinalizedAttemptId: `?${stateBindingStart + 2}`,
})

const createReadyPluginServerExistsSql = (
  pluginServerId: string,
  userId: string
): string =>
  `EXISTS (SELECT 1 FROM user_plugin_servers WHERE id = ${pluginServerId} AND user_id = ${userId} AND credential_status = 'ready')`

const createPluginDomainStateWhereSql = ({
  id,
  userId,
  pluginServerId,
  domain,
  pluginId,
  credentialGeneration,
  credentialAttemptId,
  credentialFinalizedAttemptId,
}: PluginDomainStatePredicatePlaceholders): string =>
  `id = ${id} AND user_id = ${userId} AND plugin_server_id = ${pluginServerId} AND domain = ${domain} AND plugin_id = ${pluginId} AND credential_generation IS ${credentialGeneration} AND credential_attempt_id IS ${credentialAttemptId} AND credential_finalized_attempt_id IS ${credentialFinalizedAttemptId} AND ${createReadyPluginServerExistsSql(pluginServerId, userId)}`

const createPluginDomainStatePredicate = ({
  id,
  userId,
  pluginServerId,
  domain,
  pluginId,
  credentialGeneration,
  credentialAttemptId,
  credentialFinalizedAttemptId,
}: PluginDomainStatePredicatePlaceholders): string =>
  `SELECT 1 FROM user_plugin_domains WHERE ${createPluginDomainStateWhereSql({
    id,
    userId,
    pluginServerId,
    domain,
    pluginId,
    credentialGeneration,
    credentialAttemptId,
    credentialFinalizedAttemptId,
  })}`

const pluginDomainStateBindings = (
  row: PluginDomainRow
): readonly unknown[] => [
  row.id,
  row.plugin_server_id,
  row.domain,
  row.plugin_id,
  row.credential_generation,
  row.credential_attempt_id,
  row.credential_finalized_attempt_id,
]

const pluginDomainStateUpdateBindings = (
  row: PluginDomainRow,
  userId: string
): readonly unknown[] => [
  row.id,
  userId,
  ...pluginDomainStateBindings(row).slice(1),
]

interface PluginDomainWriteConditions {
  ledgerCondition: OwnedWriteGuard
  guard: OwnedWriteGuard
}

const pluginDomainWriteConditions = (
  row: PluginDomainRow
): PluginDomainWriteConditions => {
  const conditionBindings = pluginDomainStateBindings(row)
  return {
    ledgerCondition: {
      conditionSql: createPluginDomainStatePredicate(
        createPluginDomainStateConditionPlaceholders(6, 1)
      ),
      conditionBindings,
    },
    guard: {
      conditionSql: createPluginDomainStatePredicate(
        createPluginDomainStateConditionPlaceholders(2, 1)
      ),
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
    throw new PluginDomainNotFoundError()
  }
  return domain
}

const raisePluginDomainWriteConflict = async (
  database: D1Database,
  userId: string,
  domainId: string
): Promise<never> => {
  const domain = await findDomainRowById(database, domainId)
  if (!domain || domain.user_id !== userId) {
    throw new PluginDomainNotFoundError()
  }
  await requireReadyPluginServerRow(database, userId, domain.plugin_server_id)
  throw new PluginCredentialChangeSupersededError()
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

const createOwnedPluginCredentialDeleteStatement = (
  database: D1Database,
  input: {
    credential: PluginCredentialRow
    userId: string
    pluginDomainId: string
    domainState?: PluginDomainRow
  }
): D1PreparedStatement => {
  const domainStateCondition = input.domainState
    ? ` AND EXISTS (${createPluginDomainStatePredicate(createPluginDomainStateUpdatePlaceholders(4))})`
    : ""
  return database
    .prepare(
      `DELETE FROM user_plugin_credentials WHERE id = ?1 AND user_id = ?2 AND plugin_domain_id = ?3${domainStateCondition}`
    )
    .bind(
      input.credential.id,
      input.userId,
      input.pluginDomainId,
      ...(input.domainState
        ? pluginDomainStateUpdateBindings(input.domainState, input.userId)
        : [])
    )
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
  readonly condition: OwnedWriteGuard
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
  const credentialStateBindings = [
    domainRow.credential_generation,
    domainRow.credential_attempt_id,
    domainRow.credential_finalized_attempt_id,
  ]
  const writeStatement = database
    .prepare(
      `INSERT INTO user_plugin_credentials (id, user_id, plugin_domain_id, plugin_server_id, plugin_id, domain, ciphertext, nonce, algorithm, key_version, created_at, updated_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12 WHERE EXISTS (${createPluginDomainStatePredicate(createPluginDomainCredentialInsertPlaceholders(13))}) ON CONFLICT(plugin_domain_id) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, algorithm = excluded.algorithm, key_version = excluded.key_version, updated_at = excluded.updated_at`
    )
    .bind(...credentialBindings, ...credentialStateBindings)
  return [...ledgerMutation.statements, writeStatement]
}

interface BuildDeleteCredentialMutationsInput {
  readonly database: D1Database
  readonly preparation: StorageLedgerPreparation
  readonly existingCredential: PluginCredentialRow
  readonly userId: string
  readonly pluginDomainId: string
  readonly now: number
  readonly condition?: OwnedWriteGuard
}

const buildDeleteCredentialMutations = ({
  database,
  preparation,
  existingCredential,
  userId,
  pluginDomainId,
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
    createOwnedPluginCredentialDeleteStatement(database, {
      credential: existingCredential,
      userId,
      pluginDomainId,
    }),
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
  const applied = pluginDomainWriteConditions(domainRow)
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
        `INSERT INTO user_plugin_domains (id, user_id, plugin_server_id, domain, plugin_id, credential_generation, credential_attempt_id, credential_finalized_attempt_id) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE ${createReadyPluginServerExistsSql("?3", "?2")}`
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
    throw new PluginServerUnavailableError()
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
  const applied = pluginDomainWriteConditions(nextDomainRow)
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
        `UPDATE user_plugin_domains SET plugin_id = ?4, domain = ?5, credential_generation = ?6, credential_attempt_id = ?7, credential_finalized_attempt_id = ?8 WHERE id = ?1 AND user_id = ?2 AND plugin_server_id = ?3 AND ${createReadyPluginServerExistsSql("?3", "?2")}`
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
        userId,
        pluginDomainId: existingDomainRow.id,
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
    throw new PluginServerUnavailableError()
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
      input,
    })
  }
  return updateExistingPluginDomain({
    database,
    userId,
    domain,
    existingDomainRow,
    input,
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

interface SetCredentialStatements {
  statements: D1PreparedStatement[]
  conditions: PluginDomainWriteConditions
}

const buildSetCredentialStatements = async ({
  database,
  userId,
  domainRow,
  credential,
  now,
}: BuildSetCredentialStatementsInput): Promise<SetCredentialStatements> => {
  const [existingCredential, preparation] = await Promise.all([
    findCredentialByDomainId(database, domainRow.id),
    ensureStorageLedger(database, userId, now),
  ])
  const conditions = pluginDomainWriteConditions(domainRow)
  const credentialMutations = buildReplaceCredentialMutations({
    database,
    preparation,
    userId,
    domainRow,
    credential,
    existingCredential: existingCredential ?? undefined,
    now,
    condition: conditions.ledgerCondition,
  })
  return {
    statements: [...preparation.statements, ...credentialMutations],
    conditions,
  }
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
  const prepared = await buildSetCredentialStatements({
    database,
    userId,
    domainRow,
    credential: input.credential,
    now: input.now,
  })
  const { dataVersion, changed } = await executeOwnedWrite({
    database,
    userId,
    statements: prepared.statements,
    guard: createChangedWriteGuard(prepared.conditions.guard),
  })
  if (!changed) {
    await raisePluginDomainWriteConflict(database, userId, input.domainId)
  }
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
  await requireReadyPluginServerRow(
    database,
    userId,
    domainRow.plugin_server_id
  )
  const generation = (domainRow.credential_generation ?? 0) + 1
  const attemptId = crypto.randomUUID()
  const nextRow = {
    ...domainRow,
    credential_generation: generation,
    credential_attempt_id: attemptId,
    credential_finalized_attempt_id: null,
  }
  const currentConditions = pluginDomainWriteConditions(domainRow)
  const nextConditions = pluginDomainWriteConditions(nextRow)
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
    condition: currentConditions.ledgerCondition,
  })
  const { dataVersion, changed } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      ...ledgerMutation.statements,
      database
        .prepare(
          `UPDATE user_plugin_domains SET credential_generation = ?9, credential_attempt_id = ?10, credential_finalized_attempt_id = NULL WHERE ${createPluginDomainStateWhereSql(createPluginDomainStateUpdatePlaceholders(1))}`
        )
        .bind(
          ...pluginDomainStateUpdateBindings(domainRow, userId),
          generation,
          attemptId
        ),
    ],
    guard: createChangedWriteGuard(nextConditions.guard),
  })
  if (!changed) {
    await raisePluginDomainWriteConflict(database, userId, input.domainId)
  }
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
    throw new PluginCredentialChangeSupersededError()
  }
  if (domainRow.credential_finalized_attempt_id === input.attemptId) {
    return await getDataVersion(database, userId)
  }
  const [preparedCredential, finalizationPreparation] = await Promise.all([
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
  const finalizedConditions = pluginDomainWriteConditions(finalizedRow)
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
    condition: preparedCredential.conditions.ledgerCondition,
  })
  const { dataVersion, changed } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparedCredential.statements,
      ...finalizationPreparation.statements,
      ...finalizationLedgerMutation.statements,
      database
        .prepare(
          `UPDATE user_plugin_domains SET credential_finalized_attempt_id = ?3 WHERE id = ?1 AND user_id = ?2 AND credential_generation = ?4 AND credential_attempt_id = ?5 AND credential_finalized_attempt_id IS NULL AND ${createReadyPluginServerExistsSql("?6", "?2")}`
        )
        .bind(
          domainRow.id,
          userId,
          input.attemptId,
          input.generation,
          input.attemptId,
          domainRow.plugin_server_id
        ),
    ],
    guard: createChangedWriteGuard(finalizedConditions.guard),
  })
  if (!changed) {
    await raisePluginDomainWriteConflict(database, userId, input.domainId)
  }
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
  await requireReadyPluginServerRow(
    database,
    userId,
    domainRow.plugin_server_id
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
  const currentConditions = pluginDomainWriteConditions(domainRow)
  const revokedConditions = pluginDomainWriteConditions(revokedRow)
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
    condition: currentConditions.ledgerCondition,
  })
  const statements: D1PreparedStatement[] = [...preparation.statements]
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
      condition: currentConditions.ledgerCondition,
    })
    statements.push(
      ...credentialLedgerMutation.statements,
      createOwnedPluginCredentialDeleteStatement(database, {
        credential: existingCredential,
        userId,
        pluginDomainId: domainRow.id,
        domainState: domainRow,
      })
    )
  }
  statements.push(
    ...revocationLedgerMutation.statements,
    database
      .prepare(
        `UPDATE user_plugin_domains SET credential_generation = ?9, credential_attempt_id = NULL, credential_finalized_attempt_id = NULL WHERE ${createPluginDomainStateWhereSql(createPluginDomainStateUpdatePlaceholders(1))}`
      )
      .bind(
        ...pluginDomainStateUpdateBindings(domainRow, userId),
        revokedRow.credential_generation
      )
  )
  const { dataVersion, changed } = await executeOwnedWrite({
    database,
    userId,
    statements,
    guard: createChangedWriteGuard(revokedConditions.guard),
  })
  if (!changed) {
    await raisePluginDomainWriteConflict(database, userId, input.domainId)
  }
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
      createOwnedPluginCredentialDeleteStatement(database, {
        credential: existingCredential,
        userId: domainRow.user_id,
        pluginDomainId: domainRow.id,
      })
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
