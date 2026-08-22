import {
  mergeUnique,
  removeLinkFromTree,
} from "../../app/features/links/link-tree-metadata"
import {
  EMPTY_LINK_METADATA_JSON,
  DAY_MS,
  DEFAULT_RETENTION_DAYS,
  LINK_RETENTION_BATCH_SIZE,
  LINKS_MAX_COUNT,
  RETENTION_SWEEP_MAX_BATCHES_PER_RUN,
  SAVED_LINK_COMMAND_OPERATION_CLEANUP_BATCH_SIZE,
  SAVED_LINK_COMMAND_OPERATION_TTL_MS,
} from "../constants"
import {
  extractedLinkSchema,
  parseCanonicalLinkMetadataJson,
} from "../../app/features/links/storage-schemas"
import { Schema } from "effect"
import {
  createDataVersionBumpStatement,
  executeOwnedWrite,
  getDataVersion,
} from "./data-version"
import {
  assertLinkSize,
  applyStorageMutation,
  byteLength,
  ensureStorageLedger,
} from "./storage-ledger"
import { createOpaqueId } from "./ids"
import type { LinkRow } from "./rows"

export interface SavedLinkRecord {
  id: string
  url: string
  title: string | null
  metaJson: string | null
  openedAt: number | null
  createdAt: number
  updatedAt: number
  expiresAt: number | null
}

const mapLinkRow = (row: LinkRow): SavedLinkRecord => ({
  id: row.id,
  url: row.url,
  title: row.title,
  metaJson: row.meta_json,
  openedAt: row.opened_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  expiresAt: row.expires_at,
})

const LINK_COLUMNS =
  "id, user_id, url, title, meta_json, opened_at, created_at, updated_at, expires_at"

export type SavedLinkMetadataOperation =
  | { kind: "markOpened"; linkUrl: string }
  | { kind: "cacheMirrors"; lazyItemUrl: string; mirrorsJson: string }
  | { kind: "removeExtractedLink"; linkKey: string; linkUrl: string }
  | {
      kind: "replaceExtraction"
      expectedExtractionJson: string
      extractedLinksJson: string
    }

export interface SavedLinkCommandResult {
  id: string | null
  replayed: boolean
  dataVersion: number
}

export interface SavedLinkMutationResult {
  success: boolean
  dataVersion: number
  replayed: boolean
}

const canonicalizeLinkMetadataJson = (metadataJson: string): string =>
  JSON.stringify(parseCanonicalLinkMetadataJson(metadataJson))

export const getUserRetentionDays = async (
  database: D1Database,
  userId: string
): Promise<number> => {
  const row = await database
    .prepare("SELECT storage_retention_days FROM users WHERE id = ?1")
    .bind(userId)
    .first<{ storage_retention_days: number }>()
  return row?.storage_retention_days ?? DEFAULT_RETENTION_DAYS
}

export const getRetentionCutoff = (
  now: number,
  retentionDays: number
): number => now - retentionDays * DAY_MS

export const countExpiredLinksForUser = async (
  database: D1Database,
  userId: string,
  retentionDays: number,
  now: number
): Promise<number> => {
  const row = await database
    .prepare(
      "SELECT COUNT(*) AS expired FROM links WHERE user_id = ?1 AND created_at < ?2"
    )
    .bind(userId, getRetentionCutoff(now, retentionDays))
    .first<{ expired: number }>()
  return row?.expired ?? 0
}

const findLinkById = async (
  database: D1Database,
  linkId: string
): Promise<LinkRow | null> => {
  const row = await database
    .prepare(`SELECT ${LINK_COLUMNS} FROM links WHERE id = ?1`)
    .bind(linkId)
    .first<LinkRow>()
  return row ?? null
}

const findCompletedOperation = async (
  database: D1Database,
  userId: string,
  operationId: string
): Promise<{ linkId: string | null } | null> => {
  const row = await database
    .prepare(
      "SELECT link_id FROM link_command_operations WHERE user_id = ?1 AND operation_id = ?2"
    )
    .bind(userId, operationId)
    .first<{ link_id: string | null }>()
  return row ? { linkId: row.link_id } : null
}

const insertCommandOperationStatement = (
  database: D1Database,
  input: {
    userId: string
    operationId: string
    linkId: string
    command: string
    now: number
  }
): D1PreparedStatement =>
  database
    .prepare(
      "INSERT INTO link_command_operations (user_id, operation_id, link_id, command, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
    .bind(
      input.userId,
      input.operationId,
      input.linkId,
      input.command,
      input.now,
      input.now + SAVED_LINK_COMMAND_OPERATION_TTL_MS
    )

export const listSavedLinks = async (
  database: D1Database,
  userId: string,
  now: number
): Promise<{ results: SavedLinkRecord[] }> => {
  const retentionDays = await getUserRetentionDays(database, userId)
  const cutoff = getRetentionCutoff(now, retentionDays)
  const { results } = await database
    .prepare(
      `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ?1 AND created_at >= ?2 ORDER BY created_at DESC LIMIT ?3`
    )
    .bind(userId, cutoff, LINKS_MAX_COUNT)
    .all<LinkRow>()
  return { results: results.map(mapLinkRow) }
}

export const createOrUpdateSavedLink = async (
  database: D1Database,
  userId: string,
  input: {
    operationId: string
    url: string
    title?: string | undefined
    meta?: string | undefined
    now: number
  }
): Promise<SavedLinkCommandResult> => {
  const completedOperation = await findCompletedOperation(
    database,
    userId,
    input.operationId
  )
  if (completedOperation) {
    return {
      id: completedOperation.linkId,
      replayed: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const retentionDays = await getUserRetentionDays(database, userId)
  await deleteExpiredLinksForUser(database, userId, retentionDays, input.now)

  const metadataJson = canonicalizeLinkMetadataJson(
    input.meta ?? EMPTY_LINK_METADATA_JSON
  )
  const existingRow = await database
    .prepare(
      `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ?1 AND url = ?2`
    )
    .bind(userId, input.url)
    .first<LinkRow>()

  if (existingRow) {
    const nextRow = {
      ...existingRow,
      title: input.title ?? existingRow.title,
      meta_json: metadataJson,
      updated_at: input.now,
    }
    const preparation = await ensureStorageLedger(database, userId, input.now)
    assertLinkSize(byteLength(nextRow))
    const ledgerMutation = applyStorageMutation(
      database,
      preparation,
      {
        domain: "linkBytes",
        currentBytes: byteLength(existingRow),
        nextBytes: byteLength(nextRow),
        savedLinkCountDelta: 0,
      },
      input.now
    )
    const { dataVersion } = await executeOwnedWrite(database, userId, [
      ...preparation.statements,
      database
        .prepare(
          "UPDATE links SET title = ?2, meta_json = ?3, updated_at = ?4 WHERE id = ?1"
        )
        .bind(existingRow.id, nextRow.title, metadataJson, input.now),
      ...ledgerMutation.statements,
      insertCommandOperationStatement(database, {
        userId,
        operationId: input.operationId,
        linkId: existingRow.id,
        command: "create-or-update",
        now: input.now,
      }),
    ])
    return { id: existingRow.id, replayed: false, dataVersion }
  }

  const countRow = await database
    .prepare("SELECT COUNT(*) AS count FROM links WHERE user_id = ?1")
    .bind(userId)
    .first<{ count: number }>()
  const userLinkCount = countRow?.count ?? 0
  const oldestRow =
    userLinkCount >= LINKS_MAX_COUNT
      ? ((await database
          .prepare(
            `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ?1 ORDER BY created_at ASC LIMIT 1`
          )
          .bind(userId)
          .first<LinkRow>()) ?? undefined)
      : undefined
  const newRow: LinkRow = {
    id: createOpaqueId(),
    user_id: userId,
    url: input.url,
    title: input.title ?? null,
    meta_json: metadataJson,
    opened_at: null,
    created_at: input.now,
    updated_at: input.now,
    expires_at: input.now + retentionDays * DAY_MS,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  assertLinkSize(byteLength(newRow))
  const evictionMutation = oldestRow
    ? applyStorageMutation(
        database,
        preparation,
        {
          domain: "linkBytes",
          currentBytes: byteLength(oldestRow),
          nextBytes: 0,
          savedLinkCountDelta: -1,
        },
        input.now
      )
    : undefined
  const insertionMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "linkBytes",
      currentBytes: 0,
      nextBytes: byteLength(newRow),
      savedLinkCountDelta: 1,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    ...(oldestRow
      ? [database.prepare("DELETE FROM links WHERE id = ?1").bind(oldestRow.id)]
      : []),
    ...(evictionMutation?.statements ?? []),
    database
      .prepare(
        "INSERT INTO links (id, user_id, url, title, meta_json, opened_at, created_at, updated_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
      )
      .bind(
        newRow.id,
        newRow.user_id,
        newRow.url,
        newRow.title,
        newRow.meta_json,
        newRow.opened_at,
        newRow.created_at,
        newRow.updated_at,
        newRow.expires_at
      ),
    ...insertionMutation.statements,
    insertCommandOperationStatement(database, {
      userId,
      operationId: input.operationId,
      linkId: newRow.id,
      command: "create-or-update",
      now: input.now,
    }),
  ])
  return { id: newRow.id, replayed: false, dataVersion }
}

const requireOwnedLink = async (
  database: D1Database,
  userId: string,
  linkId: string
): Promise<LinkRow> => {
  const existing = await findLinkById(database, linkId)
  if (!existing || existing.user_id !== userId) {
    throw new Error("Link not found or no longer available")
  }
  return existing
}

export const updateSavedLinkMeta = async (
  database: D1Database,
  userId: string,
  input: {
    operationId: string
    id: string
    meta: string
    now: number
  }
): Promise<SavedLinkMutationResult> => {
  const completedOperation = await findCompletedOperation(
    database,
    userId,
    input.operationId
  )
  if (completedOperation) {
    return {
      success: true,
      replayed: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const existingRow = await requireOwnedLink(database, userId, input.id)
  const metadataJson = canonicalizeLinkMetadataJson(input.meta)
  const nextRow = {
    ...existingRow,
    meta_json: metadataJson,
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  assertLinkSize(byteLength(nextRow))
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "linkBytes",
      currentBytes: byteLength(existingRow),
      nextBytes: byteLength(nextRow),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    database
      .prepare("UPDATE links SET meta_json = ?2, updated_at = ?3 WHERE id = ?1")
      .bind(existingRow.id, metadataJson, input.now),
    ...ledgerMutation.statements,
    insertCommandOperationStatement(database, {
      userId,
      operationId: input.operationId,
      linkId: existingRow.id,
      command: "update-meta",
      now: input.now,
    }),
  ])
  return { success: true, replayed: false, dataVersion }
}

export const applySavedLinkMetadataOperation = async (
  database: D1Database,
  userId: string,
  input: {
    operationId: string
    id: string
    operation: SavedLinkMetadataOperation
    now: number
  }
): Promise<SavedLinkMutationResult> => {
  const completedOperation = await findCompletedOperation(
    database,
    userId,
    input.operationId
  )
  if (completedOperation) {
    return {
      success: true,
      replayed: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const existingRow = await requireOwnedLink(database, userId, input.id)
  const metadata = parseCanonicalLinkMetadataJson(
    existingRow.meta_json ?? EMPTY_LINK_METADATA_JSON
  )
  switch (input.operation.kind) {
    case "markOpened": {
      metadata.playback.openedUrls = mergeUnique(metadata.playback.openedUrls, [
        input.operation.linkUrl,
      ])
      break
    }
    case "cacheMirrors": {
      const mirrors = Schema.decodeUnknownSync(
        Schema.Array(extractedLinkSchema)
      )(JSON.parse(input.operation.mirrorsJson))
      metadata.playback.resolvedMirrors = {
        ...metadata.playback.resolvedMirrors,
        [input.operation.lazyItemUrl]: [...mirrors],
      }
      break
    }
    case "removeExtractedLink": {
      const operation = input.operation
      metadata.extraction.extractedLinks = removeLinkFromTree(
        metadata.extraction.extractedLinks,
        operation.linkKey
      )
      metadata.playback.openedUrls = metadata.playback.openedUrls.filter(
        (openedUrl) => openedUrl !== operation.linkUrl
      )
      metadata.playback.openedIds = metadata.playback.openedIds.filter(
        (openedId) => openedId !== operation.linkKey
      )
      break
    }
    case "replaceExtraction": {
      const currentExtractionJson = JSON.stringify(
        metadata.extraction.extractedLinks
      )
      if (currentExtractionJson !== input.operation.expectedExtractionJson) {
        throw new Error("Saved link extraction changed; refresh and retry")
      }
      const links = Schema.decodeUnknownSync(Schema.Array(extractedLinkSchema))(
        JSON.parse(input.operation.extractedLinksJson)
      )
      metadata.extraction.extractedLinks = [...links]
      metadata.playback.resolvedMirrors = {}
      break
    }
  }
  const nextRow = {
    ...existingRow,
    meta_json: JSON.stringify(metadata),
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  assertLinkSize(byteLength(nextRow))
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "linkBytes",
      currentBytes: byteLength(existingRow),
      nextBytes: byteLength(nextRow),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    database
      .prepare("UPDATE links SET meta_json = ?2, updated_at = ?3 WHERE id = ?1")
      .bind(existingRow.id, nextRow.meta_json, input.now),
    ...ledgerMutation.statements,
    insertCommandOperationStatement(database, {
      userId,
      operationId: input.operationId,
      linkId: existingRow.id,
      command: "apply-metadata-operation",
      now: input.now,
    }),
  ])
  return { success: true, replayed: false, dataVersion }
}

export const deleteSavedLinkById = async (
  database: D1Database,
  userId: string,
  input: { id: string; now: number }
): Promise<SavedLinkMutationResult> => {
  const existingRow = await requireOwnedLink(database, userId, input.id)
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "linkBytes",
      currentBytes: byteLength(existingRow),
      nextBytes: 0,
      savedLinkCountDelta: -1,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    database.prepare("DELETE FROM links WHERE id = ?1").bind(existingRow.id),
    ...ledgerMutation.statements,
  ])
  return { success: true, replayed: false, dataVersion }
}

export const clearSavedLinks = async (
  database: D1Database,
  userId: string,
  input: { now: number }
): Promise<{ success: boolean; deletedLinks: number; dataVersion: number }> => {
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const savedLinkCount = preparation.ledger.savedLinkCount
  if (savedLinkCount === 0) {
    return {
      success: true,
      deletedLinks: 0,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "linkBytes",
      currentBytes: preparation.ledger.linkBytes,
      nextBytes: 0,
      savedLinkCountDelta: -savedLinkCount,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    database.prepare("DELETE FROM links WHERE user_id = ?1").bind(userId),
    ...ledgerMutation.statements,
  ])
  return { success: true, deletedLinks: savedLinkCount, dataVersion }
}

export const deleteExpiredLinksForUser = async (
  database: D1Database,
  userId: string,
  retentionDays: number,
  now: number
): Promise<number> => {
  const cutoff = getRetentionCutoff(now, retentionDays)
  const { results } = await database
    .prepare(
      `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ?1 AND created_at < ?2 ORDER BY created_at ASC LIMIT ?3`
    )
    .bind(userId, cutoff, LINK_RETENTION_BATCH_SIZE)
    .all<LinkRow>()
  if (results.length === 0) {
    return 0
  }
  const totalBytes = results.reduce<number>(
    (totalBytes, row) => totalBytes + byteLength(row),
    0
  )
  const placeholders = results.map((_, index) => `?${index + 1}`).join(", ")
  const preparation = await ensureStorageLedger(database, userId, now)
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "linkBytes",
      currentBytes: totalBytes,
      nextBytes: 0,
      savedLinkCountDelta: -results.length,
    },
    now
  )
  await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    database
      .prepare(`DELETE FROM links WHERE id IN (${placeholders})`)
      .bind(...results.map((row) => row.id)),
    ...ledgerMutation.statements,
  ])
  return results.length
}

export interface RetentionSweepOutcome {
  deletedLinks: number
  continued: boolean
}

export const sweepExpiredLinks = async (
  database: D1Database,
  now: number
): Promise<RetentionSweepOutcome> => {
  let deletedLinks = 0
  let continued = false
  for (
    let batchIndex = 0;
    batchIndex < RETENTION_SWEEP_MAX_BATCHES_PER_RUN;
    batchIndex += 1
  ) {
    const { results } = await database
      .prepare(
        `SELECT ${LINK_COLUMNS} FROM links WHERE expires_at IS NOT NULL AND expires_at <= ?1 LIMIT ?2`
      )
      .bind(now, LINK_RETENTION_BATCH_SIZE)
      .all<LinkRow>()
    if (results.length === 0) {
      break
    }
    deletedLinks += results.length
    continued = results.length === LINK_RETENTION_BATCH_SIZE
    const bytesByUser = new Map<string, number>()
    for (const row of results) {
      bytesByUser.set(
        row.user_id,
        (bytesByUser.get(row.user_id) ?? 0) + byteLength(row)
      )
    }
    const statements: D1PreparedStatement[] = []
    for (const [expiredUserId, expiredBytes] of bytesByUser) {
      const preparation = await ensureStorageLedger(
        database,
        expiredUserId,
        now
      )
      statements.push(...preparation.statements)
      const ledgerMutation = applyStorageMutation(
        database,
        preparation,
        {
          domain: "linkBytes",
          currentBytes: expiredBytes,
          nextBytes: 0,
          savedLinkCountDelta: -results.filter(
            (row) => row.user_id === expiredUserId
          ).length,
        },
        now
      )
      statements.push(...ledgerMutation.statements)
      statements.push(createDataVersionBumpStatement(database, expiredUserId))
    }
    const placeholders = results.map((_, index) => `?${index + 1}`).join(", ")
    statements.push(
      database
        .prepare(`DELETE FROM links WHERE id IN (${placeholders})`)
        .bind(...results.map((row) => row.id))
    )
    await database.batch(statements)
    if (!continued) {
      break
    }
  }
  return { deletedLinks, continued }
}

export const cleanupSavedLinkCommandOperations = async (
  database: D1Database,
  now: number
): Promise<{ deleted: number }> => {
  const result = await database
    .prepare(
      "DELETE FROM link_command_operations WHERE rowid IN (SELECT rowid FROM link_command_operations WHERE expires_at <= ?1 LIMIT ?2)"
    )
    .bind(now, SAVED_LINK_COMMAND_OPERATION_CLEANUP_BATCH_SIZE)
    .run()
  return { deleted: result.meta.changes ?? 0 }
}
