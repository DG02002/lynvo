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
} from "../constants"
import {
  extractedLinkSchema,
  parseCanonicalLinkMetadataJson,
} from "../../app/features/links/storage-schemas"
import type { ExtractedLink } from "../../app/features/links/types"
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
import {
  createReservedSavedLinkOperationLinkStatement,
  findCompletedSavedLinkOperation,
  releaseReservedSavedLinkCommandOperation,
  requireOwnedSavedLink,
  reserveSavedLinkCommandOperation,
  SAVED_LINK_COLUMNS,
} from "./saved-link-storage"

export interface SavedLinkRecord {
  id: string
  url: string
  title: string | null
  metaJson: string | null
  openedAt: number | null
  createdAt: number
  updatedAt: number
  expiresAt: number | null
  extractionState: "queued" | "running" | "complete" | "failed"
  extractionError: string | null
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
  extractionState: row.extraction_state,
  extractionError: row.extraction_error,
})

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

export const listSavedLinks = async (
  database: D1Database,
  userId: string,
  now: number
): Promise<{ results: SavedLinkRecord[] }> => {
  const retentionDays = await getUserRetentionDays(database, userId)
  const cutoff = getRetentionCutoff(now, retentionDays)
  const { results } = await database
    .prepare(
      `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE user_id = ?1 AND created_at >= ?2 ORDER BY created_at DESC LIMIT ?3`
    )
    .bind(userId, cutoff, LINKS_MAX_COUNT)
    .all<LinkRow>()
  return { results: results.map(mapLinkRow) }
}

export const listSavedLinksWithDataVersion = async (
  database: D1Database,
  userId: string,
  now: number
): Promise<{ results: SavedLinkRecord[]; dataVersion: number }> => {
  const retentionDays = await getUserRetentionDays(database, userId)
  const cutoff = getRetentionCutoff(now, retentionDays)
  const batchResults = await database.batch([
    database
      .prepare(
        `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE user_id = ?1 AND created_at >= ?2 ORDER BY created_at DESC LIMIT ?3`
      )
      .bind(userId, cutoff, LINKS_MAX_COUNT),
    database
      .prepare("SELECT data_version FROM users WHERE id = ?1")
      .bind(userId),
  ])
  // SAFETY: the batch is one transaction, so items and version are read
  // atomically; the row shapes match SAVED_LINK_COLUMNS and users.data_version.
  const linkRows = (batchResults[0]?.results ?? []) as LinkRow[]
  // SAFETY: see the linkRows invariant; the users row is keyed by user id.
  const versionRow = batchResults[1]?.results?.[0] as
    | { data_version: number }
    | undefined
  return {
    results: (linkRows ?? []).map(mapLinkRow),
    dataVersion: versionRow?.data_version ?? 0,
  }
}

export const createOrUpdateSavedLink = async (
  database: D1Database,
  userId: string,
  input: {
    operationId: string
    url: string
    title?: string | undefined
    meta?: string | undefined
    extractionState?: "queued" | undefined
    now: number
  }
): Promise<SavedLinkCommandResult> => {
  const completedOperation = await findCompletedSavedLinkOperation(
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
  const reserved = await reserveSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
    command: "create-or-update",
    now: input.now,
  })
  if (!reserved) {
    const twinOperation = await findCompletedSavedLinkOperation(
      database,
      userId,
      input.operationId
    )
    return {
      id: twinOperation?.linkId ?? null,
      replayed: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const retentionDays = await getUserRetentionDays(database, userId)
  await deleteExpiredLinksForUser(database, userId, retentionDays, input.now)

  const metadataJson = canonicalizeLinkMetadataJson(
    input.meta ?? EMPTY_LINK_METADATA_JSON
  )
  const extractionState = input.extractionState ?? "complete"
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const existingRow = await database
        .prepare(
          `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE user_id = ?1 AND url = ?2`
        )
        .bind(userId, input.url)
        .first<LinkRow>()

      if (existingRow) {
        const nextRow: LinkRow = {
          ...existingRow,
          title: input.title ?? existingRow.title,
          meta_json: metadataJson,
          updated_at: input.now,
          // Re-saving refreshes the retention clock: the countdown runs from
          // the last save, not the first.
          expires_at: input.now + retentionDays * DAY_MS,
          extraction_state: extractionState,
          extraction_error: null,
          extraction_attempts:
            extractionState === "queued" ? 0 : existingRow.extraction_attempts,
          extraction_available_at:
            extractionState === "queued" ? input.now : null,
          extraction_lease_expires_at: null,
        }
        const preparation = await ensureStorageLedger(
          database,
          userId,
          input.now
        )
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
        const { dataVersion, changed } = await executeOwnedWrite(
          database,
          userId,
          [
            ...preparation.statements,
            database
              .prepare(
                "UPDATE links SET title = ?2, meta_json = ?3, updated_at = ?4, expires_at = ?5, extraction_state = ?6, extraction_error = ?7, extraction_attempts = ?8, extraction_available_at = ?9, extraction_lease_expires_at = ?10 WHERE id = ?1 AND meta_json IS ?11"
              )
              .bind(
                existingRow.id,
                nextRow.title,
                metadataJson,
                input.now,
                nextRow.expires_at,
                nextRow.extraction_state,
                nextRow.extraction_error,
                nextRow.extraction_attempts,
                nextRow.extraction_available_at,
                nextRow.extraction_lease_expires_at,
                existingRow.meta_json
              ),
            ...ledgerMutation.statements,
            createReservedSavedLinkOperationLinkStatement(database, {
              userId,
              operationId: input.operationId,
              linkId: existingRow.id,
            }),
          ]
        )
        if (!changed) {
          continue
        }
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
                `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE user_id = ?1 ORDER BY created_at ASC LIMIT 1`
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
        extraction_state: extractionState,
        extraction_error: null,
        extraction_attempts: 0,
        extraction_available_at:
          extractionState === "queued" ? input.now : null,
        extraction_lease_expires_at: null,
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
          ? [
              database
                .prepare("DELETE FROM links WHERE id = ?1")
                .bind(oldestRow.id),
            ]
          : []),
        ...(evictionMutation?.statements ?? []),
        database
          .prepare(
            "INSERT INTO links (id, user_id, url, title, meta_json, opened_at, created_at, updated_at, expires_at, extraction_state, extraction_error, extraction_attempts, extraction_available_at, extraction_lease_expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)"
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
            newRow.expires_at,
            newRow.extraction_state,
            newRow.extraction_error,
            newRow.extraction_attempts,
            newRow.extraction_available_at,
            newRow.extraction_lease_expires_at
          ),
        ...insertionMutation.statements,
        createReservedSavedLinkOperationLinkStatement(database, {
          userId,
          operationId: input.operationId,
          linkId: newRow.id,
        }),
      ])
      return { id: newRow.id, replayed: false, dataVersion }
    } catch (error) {
      // SAFETY: D1 surfaces constraint failures as message strings only; this is
      // the sole signal that a concurrent save inserted the same URL first.
      if (
        attempt === 0 &&
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed: links.url")
      ) {
        continue
      }
      await releaseReservedSavedLinkCommandOperation(database, {
        userId,
        operationId: input.operationId,
      })
      throw error
    }
  }
  await releaseReservedSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
  })
  throw new Error("Saved link changed while saving; retry")
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
  const completedOperation = await findCompletedSavedLinkOperation(
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
  const reserved = await reserveSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
    command: "update-meta",
    now: input.now,
  })
  if (!reserved) {
    return {
      success: true,
      replayed: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const metadataJson = canonicalizeLinkMetadataJson(input.meta)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const existingRow = await requireOwnedSavedLink(
        database,
        userId,
        input.id
      )
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
      const { dataVersion, changed } = await executeOwnedWrite(
        database,
        userId,
        [
          ...preparation.statements,
          database
            .prepare(
              "UPDATE links SET meta_json = ?2, updated_at = ?3 WHERE id = ?1 AND meta_json IS ?4"
            )
            .bind(
              existingRow.id,
              metadataJson,
              input.now,
              existingRow.meta_json
            ),
          ...ledgerMutation.statements,
          createReservedSavedLinkOperationLinkStatement(database, {
            userId,
            operationId: input.operationId,
            linkId: existingRow.id,
          }),
        ]
      )
      if (!changed) {
        continue
      }
      return { success: true, replayed: false, dataVersion }
    } catch (error) {
      await releaseReservedSavedLinkCommandOperation(database, {
        userId,
        operationId: input.operationId,
      })
      throw error
    }
  }
  await releaseReservedSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
  })
  return {
    success: false,
    replayed: false,
    dataVersion: await getDataVersion(database, userId),
  }
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
  const completedOperation = await findCompletedSavedLinkOperation(
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
  const reserved = await reserveSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
    command: "apply-metadata-operation",
    now: input.now,
  })
  if (!reserved) {
    return {
      success: true,
      replayed: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const existingRow = await requireOwnedSavedLink(
        database,
        userId,
        input.id
      )
      const metadata = parseCanonicalLinkMetadataJson(
        existingRow.meta_json ?? EMPTY_LINK_METADATA_JSON
      )
      switch (input.operation.kind) {
        case "markOpened": {
          metadata.playback.openedUrls = mergeUnique(
            metadata.playback.openedUrls,
            [input.operation.linkUrl]
          )
          break
        }
        case "cacheMirrors": {
          const mirrors = Schema.decodeUnknownSync(
            Schema.Array(extractedLinkSchema)
          )(JSON.parse(input.operation.mirrorsJson))
          const isMirrorFresh = (mirror: ExtractedLink): boolean =>
            mirror.expiry === undefined || mirror.expiry > input.now
          const prunedResolvedMirrors: Record<string, ExtractedLink[]> = {}
          for (const [lazyItemUrl, cachedMirrors] of Object.entries(
            metadata.playback.resolvedMirrors ?? {}
          )) {
            const freshCachedMirrors = cachedMirrors.filter(isMirrorFresh)
            if (freshCachedMirrors.length > 0) {
              prunedResolvedMirrors[lazyItemUrl] = freshCachedMirrors
            }
          }
          const freshMirrors = mirrors.filter(isMirrorFresh)
          if (freshMirrors.length > 0) {
            prunedResolvedMirrors[input.operation.lazyItemUrl] = freshMirrors
          }
          metadata.playback.resolvedMirrors = prunedResolvedMirrors
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
          break
        }
        case "replaceExtraction": {
          const currentExtractionJson = JSON.stringify(
            metadata.extraction.extractedLinks
          )
          if (
            currentExtractionJson !== input.operation.expectedExtractionJson
          ) {
            throw new Error("Saved link extraction changed; refresh and retry")
          }
          const links = Schema.decodeUnknownSync(
            Schema.Array(extractedLinkSchema)
          )(JSON.parse(input.operation.extractedLinksJson))
          metadata.extraction.extractedLinks = [...links]
          metadata.playback.resolvedMirrors = {}
          break
        }
      }
      const nextRow = {
        ...existingRow,
        meta_json: JSON.stringify(metadata),
        updated_at: input.now,
        extraction_state:
          input.operation.kind === "replaceExtraction"
            ? ("complete" as const)
            : existingRow.extraction_state,
        extraction_error:
          input.operation.kind === "replaceExtraction"
            ? null
            : existingRow.extraction_error,
        extraction_available_at:
          input.operation.kind === "replaceExtraction"
            ? null
            : existingRow.extraction_available_at,
        extraction_lease_expires_at:
          input.operation.kind === "replaceExtraction"
            ? null
            : existingRow.extraction_lease_expires_at,
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
      const { dataVersion, changed } = await executeOwnedWrite(
        database,
        userId,
        [
          ...preparation.statements,
          database
            .prepare(
              "UPDATE links SET meta_json = ?2, updated_at = ?3, extraction_state = ?4, extraction_error = ?5, extraction_available_at = ?6, extraction_lease_expires_at = ?7 WHERE id = ?1 AND meta_json IS ?8"
            )
            .bind(
              existingRow.id,
              nextRow.meta_json,
              input.now,
              nextRow.extraction_state,
              nextRow.extraction_error,
              nextRow.extraction_available_at,
              nextRow.extraction_lease_expires_at,
              existingRow.meta_json
            ),
          ...ledgerMutation.statements,
          createReservedSavedLinkOperationLinkStatement(database, {
            userId,
            operationId: input.operationId,
            linkId: existingRow.id,
          }),
        ]
      )
      if (!changed) {
        continue
      }
      return { success: true, replayed: false, dataVersion }
    } catch (error) {
      await releaseReservedSavedLinkCommandOperation(database, {
        userId,
        operationId: input.operationId,
      })
      throw error
    }
  }
  await releaseReservedSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
  })
  return {
    success: false,
    replayed: false,
    dataVersion: await getDataVersion(database, userId),
  }
}

export const deleteSavedLinkById = async (
  database: D1Database,
  userId: string,
  input: { operationId: string; id: string; now: number }
): Promise<SavedLinkMutationResult> => {
  const completedOperation = await findCompletedSavedLinkOperation(
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
  const reserved = await reserveSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
    command: "delete",
    now: input.now,
  })
  if (!reserved) {
    return {
      success: true,
      replayed: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  try {
    const existingRow = await requireOwnedSavedLink(database, userId, input.id)
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
  } catch (error) {
    await releaseReservedSavedLinkCommandOperation(database, {
      userId,
      operationId: input.operationId,
    })
    throw error
  }
}

export const clearSavedLinks = async (
  database: D1Database,
  userId: string,
  input: { operationId: string; now: number }
): Promise<{
  success: boolean
  replayed: boolean
  deletedLinks: number
  dataVersion: number
}> => {
  const completedOperation = await findCompletedSavedLinkOperation(
    database,
    userId,
    input.operationId
  )
  if (completedOperation) {
    return {
      success: true,
      replayed: true,
      deletedLinks: 0,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const reserved = await reserveSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
    command: "clear",
    now: input.now,
  })
  if (!reserved) {
    return {
      success: true,
      replayed: true,
      deletedLinks: 0,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const savedLinkCount = preparation.ledger.savedLinkCount
  if (savedLinkCount === 0) {
    return {
      success: true,
      replayed: false,
      deletedLinks: 0,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  try {
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
    return {
      success: true,
      replayed: false,
      deletedLinks: savedLinkCount,
      dataVersion,
    }
  } catch (error) {
    await releaseReservedSavedLinkCommandOperation(database, {
      userId,
      operationId: input.operationId,
    })
    throw error
  }
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
      `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE user_id = ?1 AND created_at < ?2 ORDER BY created_at ASC LIMIT ?3`
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
        `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE expires_at IS NOT NULL AND expires_at <= ?1 LIMIT ?2`
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
    const dataVersionStatements: D1PreparedStatement[] = []
    const expiredUsers = [...bytesByUser].map(
      ([expiredUserId, expiredBytes]) => ({ expiredUserId, expiredBytes })
    )
    const preparations = await Promise.all(
      expiredUsers.map(async ({ expiredUserId, expiredBytes }) => {
        const preparation = await ensureStorageLedger(
          database,
          expiredUserId,
          now
        )
        return {
          expiredBytes,
          expiredLinkCount: results.filter(
            (row) => row.user_id === expiredUserId
          ).length,
          expiredUserId,
          preparation,
        }
      })
    )
    for (const preparedUser of preparations) {
      const { expiredBytes, expiredLinkCount, expiredUserId, preparation } =
        preparedUser
      statements.push(...preparation.statements)
      const ledgerMutation = applyStorageMutation(
        database,
        preparation,
        {
          domain: "linkBytes",
          currentBytes: expiredBytes,
          nextBytes: 0,
          savedLinkCountDelta: -expiredLinkCount,
        },
        now
      )
      statements.push(...ledgerMutation.statements)
      dataVersionStatements.push(
        createDataVersionBumpStatement(database, expiredUserId)
      )
    }
    const placeholders = results.map((_, index) => `?${index + 1}`).join(", ")
    statements.push(
      database
        .prepare(`DELETE FROM links WHERE id IN (${placeholders})`)
        .bind(...results.map((row) => row.id))
    )
    statements.push(...dataVersionStatements)
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
