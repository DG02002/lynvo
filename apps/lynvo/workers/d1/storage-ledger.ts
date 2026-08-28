import {
  LINK_LIMIT_BYTES,
  STORAGE_LEDGER_SCHEMA_VERSION,
  STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT,
  USER_STORAGE_LIMIT_BYTES,
} from "../constants"
import { LinkTooLargeError, StorageLimitError } from "./errors"
import {
  PLUGIN_CREDENTIAL_COLUMNS,
  PLUGIN_DOMAIN_COLUMNS,
  PLUGIN_SERVER_COLUMNS,
  USER_COLUMNS,
  profileStorageDocument,
  type LinkRow,
  type PluginCredentialRow,
  type PluginDomainRow,
  type PluginServerRow,
  type ProfileUserRow,
} from "./rows"
import { SAVED_LINK_COLUMNS } from "./saved-link-storage"

export const LEDGER_DOMAIN_COLUMNS = {
  profileBytes: "profile_bytes",
  linkBytes: "link_bytes",
  pluginServerBytes: "plugin_server_bytes",
  pluginDomainBytes: "plugin_domain_bytes",
  pluginCredentialBytes: "plugin_credential_bytes",
} as const

export type StorageLedgerDomain = keyof typeof LEDGER_DOMAIN_COLUMNS

export interface AppOwnedStorageUsage {
  readonly profileBytes: number
  readonly linkBytes: number
  readonly pluginServerBytes: number
  readonly pluginDomainBytes: number
  readonly pluginCredentialBytes: number
  readonly savedLinkCount: number
  readonly totalEnforcedBytes: number
}

export interface StorageLedgerRecord extends AppOwnedStorageUsage {
  readonly userId: string
  readonly schemaVersion: number
  readonly updatedAt: number
}

const STORAGE_LEDGER_COLUMNS =
  "user_id, schema_version, profile_bytes, link_bytes, plugin_server_bytes, plugin_domain_bytes, plugin_credential_bytes, saved_link_count, total_enforced_bytes, updated_at"

interface StorageLedgerRow {
  user_id: string
  schema_version: number
  profile_bytes: number
  link_bytes: number
  plugin_server_bytes: number
  plugin_domain_bytes: number
  plugin_credential_bytes: number
  saved_link_count: number
  total_enforced_bytes: number
  updated_at: number
}

const mapLedgerRow = (row: StorageLedgerRow): StorageLedgerRecord => ({
  userId: row.user_id,
  schemaVersion: row.schema_version,
  profileBytes: row.profile_bytes,
  linkBytes: row.link_bytes,
  pluginServerBytes: row.plugin_server_bytes,
  pluginDomainBytes: row.plugin_domain_bytes,
  pluginCredentialBytes: row.plugin_credential_bytes,
  savedLinkCount: row.saved_link_count,
  totalEnforcedBytes: row.total_enforced_bytes,
  updatedAt: row.updated_at,
})

const encoder = new TextEncoder()

export const byteLength = <Document>(document: Document): number =>
  encoder.encode(JSON.stringify(document)).length

const sumDocumentBytes = <Document>(documents: readonly Document[]): number =>
  documents.reduce<number>(
    (totalBytes, document) => totalBytes + byteLength(document),
    0
  )

const readBoundedRows = async <Row>(
  database: D1Database,
  table: string,
  columns: string,
  userId: string
): Promise<Row[]> => {
  const result = await database
    .prepare(`SELECT ${columns} FROM ${table} WHERE user_id = ?1 LIMIT ?2`)
    .bind(userId, STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1)
    .all<Row>()
  if (result.results.length > STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT) {
    throw new Error(`Storage ${table} inventory requires reconciliation`)
  }
  return result.results
}

export const calculateAppOwnedStorageUsage = async (
  database: D1Database,
  userId: string
): Promise<AppOwnedStorageUsage> => {
  const [userRow, links, pluginServers, pluginDomains, pluginCredentials] =
    await Promise.all([
      database
        .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?1`)
        .bind(userId)
        .first<ProfileUserRow>(),
      readBoundedRows<LinkRow>(database, "links", SAVED_LINK_COLUMNS, userId),
      readBoundedRows<PluginServerRow>(
        database,
        "user_plugin_servers",
        PLUGIN_SERVER_COLUMNS,
        userId
      ),
      readBoundedRows<PluginDomainRow>(
        database,
        "user_plugin_domains",
        PLUGIN_DOMAIN_COLUMNS,
        userId
      ),
      readBoundedRows<PluginCredentialRow>(
        database,
        "user_plugin_credentials",
        PLUGIN_CREDENTIAL_COLUMNS,
        userId
      ),
    ])
  const profileBytes = userRow ? byteLength(profileStorageDocument(userRow)) : 0
  const linkBytes = sumDocumentBytes(links)
  const pluginServerBytes = sumDocumentBytes(pluginServers)
  const pluginDomainBytes = sumDocumentBytes(pluginDomains)
  const pluginCredentialBytes = sumDocumentBytes(pluginCredentials)
  return {
    profileBytes,
    linkBytes,
    pluginServerBytes,
    pluginDomainBytes,
    pluginCredentialBytes,
    savedLinkCount: links.length,
    totalEnforcedBytes:
      profileBytes +
      linkBytes +
      pluginServerBytes +
      pluginDomainBytes +
      pluginCredentialBytes,
  }
}

export const getStorageLedger = async (
  database: D1Database,
  userId: string
): Promise<StorageLedgerRecord | null> => {
  const row = await database
    .prepare(
      `SELECT ${STORAGE_LEDGER_COLUMNS} FROM storage_ledgers WHERE user_id = ?1`
    )
    .bind(userId)
    .first<StorageLedgerRow>()
  return row ? mapLedgerRow(row) : null
}

export interface StorageLedgerPreparation {
  readonly ledger: StorageLedgerRecord
  readonly statements: readonly D1PreparedStatement[]
}

export const ensureStorageLedger = async (
  database: D1Database,
  userId: string,
  now: number
): Promise<StorageLedgerPreparation> => {
  const existing = await getStorageLedger(database, userId)
  if (existing && existing.schemaVersion === STORAGE_LEDGER_SCHEMA_VERSION) {
    return { ledger: existing, statements: [] }
  }
  const usage = await calculateAppOwnedStorageUsage(database, userId)
  const statement = database
    .prepare(
      `INSERT INTO storage_ledgers (user_id, schema_version, profile_bytes, link_bytes, plugin_server_bytes, plugin_domain_bytes, plugin_credential_bytes, saved_link_count, total_enforced_bytes, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
       ON CONFLICT(user_id) DO UPDATE SET schema_version = ?2, profile_bytes = ?3, link_bytes = ?4, plugin_server_bytes = ?5, plugin_domain_bytes = ?6, plugin_credential_bytes = ?7, saved_link_count = ?8, total_enforced_bytes = ?9, updated_at = ?10`
    )
    .bind(
      userId,
      STORAGE_LEDGER_SCHEMA_VERSION,
      usage.profileBytes,
      usage.linkBytes,
      usage.pluginServerBytes,
      usage.pluginDomainBytes,
      usage.pluginCredentialBytes,
      usage.savedLinkCount,
      usage.totalEnforcedBytes,
      now
    )
  return {
    ledger: {
      userId,
      schemaVersion: STORAGE_LEDGER_SCHEMA_VERSION,
      ...usage,
      updatedAt: now,
    },
    statements: [statement],
  }
}

export interface LedgerMutationPlan {
  readonly domain: StorageLedgerDomain
  readonly currentBytes: number
  readonly nextBytes: number
  readonly savedLinkCountDelta: number
}

export interface AppliedLedgerMutation {
  readonly statements: readonly D1PreparedStatement[]
  readonly deltaBytes: number
  readonly totalEnforcedBytes: number
}

export const withAppliedMutation = (
  preparation: StorageLedgerPreparation,
  applied: AppliedLedgerMutation
): StorageLedgerPreparation => ({
  ...preparation,
  ledger: {
    ...preparation.ledger,
    totalEnforcedBytes: applied.totalEnforcedBytes,
  },
})

export const applyStorageMutation = (
  database: D1Database,
  preparation: StorageLedgerPreparation,
  plan: LedgerMutationPlan,
  now: number
): AppliedLedgerMutation => {
  const deltaBytes = plan.nextBytes - plan.currentBytes
  const totalEnforcedBytes = preparation.ledger.totalEnforcedBytes + deltaBytes
  assertStorageGrowth(totalEnforcedBytes, deltaBytes)
  const column = LEDGER_DOMAIN_COLUMNS[plan.domain]
  const statement = database
    .prepare(
      `UPDATE storage_ledgers SET ${column} = ${column} + ?2, saved_link_count = saved_link_count + ?3, total_enforced_bytes = total_enforced_bytes + ?4, updated_at = ?5 WHERE user_id = ?1`
    )
    .bind(
      preparation.ledger.userId,
      deltaBytes,
      plan.savedLinkCountDelta,
      deltaBytes,
      now
    )
  return { statements: [statement], deltaBytes, totalEnforcedBytes }
}

export const assertStorageGrowth = (
  projectedStorageBytes: number,
  storageDeltaBytes: number
): void => {
  if (
    storageDeltaBytes > 0 &&
    projectedStorageBytes > USER_STORAGE_LIMIT_BYTES
  ) {
    throw new StorageLimitError(projectedStorageBytes, USER_STORAGE_LIMIT_BYTES)
  }
}

export const assertLinkSize = (linkBytes: number): void => {
  if (linkBytes > LINK_LIMIT_BYTES) {
    throw new LinkTooLargeError(linkBytes, LINK_LIMIT_BYTES)
  }
}
