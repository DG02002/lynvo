import { createLinkMetadata } from "../../app/features/links/links.mapper"
import { parseCanonicalLinkMetadataJson } from "../../app/features/links/storage-schemas"
import { getLinkTitle } from "../../app/features/links/use-links/link-items"
import type { ExtractedLink, MetaData } from "../../app/features/links/types"
import {
  EMPTY_LINK_METADATA_JSON,
  LINK_EXTRACTION_LEASE_MS,
  LINK_EXTRACTION_MAX_PENDING_RETRY_SECONDS,
} from "../constants"
import { createOrUpdateSavedLink, type SavedLinkMutationResult } from "./links"
import {
  createConditionalSavedLinkCommandOperationStatement,
  findCompletedSavedLinkOperation,
  findSavedLinkById,
  SAVED_LINK_COLUMNS,
} from "./saved-link-storage"
import {
  applyStorageMutation,
  assertLinkSize,
  byteLength,
  ensureStorageLedger,
  LEDGER_DOMAIN_COLUMNS,
} from "./storage-ledger"
import { executeOwnedWrite, getDataVersion } from "./data-version"
import type { LinkRow } from "./rows"

export interface SavedLinkExtractionJob {
  id: string
  userId: string
  url: string
  metaJson: string | null
  title: string | null
  extractionAttempts: number
  leaseExpiresAt: number
}

export interface SavedLinkExtractionClaim extends SavedLinkExtractionJob {
  dataVersion: number
}

export const enqueueSavedLinkExtraction = (
  database: D1Database,
  userId: string,
  input: {
    operationId: string
    url: string
    title?: string | undefined
    meta?: string | undefined
    now: number
  }
) =>
  createOrUpdateSavedLink(database, userId, {
    ...input,
    extractionState: "queued",
  })

const findNextExtractionCandidate = async (
  database: D1Database,
  now: number,
  linkId?: string
): Promise<LinkRow | null> => {
  const linkFilter = linkId ? "AND id = ?2" : ""
  const statement = database.prepare(
    `SELECT ${SAVED_LINK_COLUMNS} FROM links
     WHERE (
       (extraction_state = 'queued' AND (extraction_available_at IS NULL OR extraction_available_at <= ?1))
       OR (extraction_state = 'running' AND extraction_lease_expires_at IS NOT NULL AND extraction_lease_expires_at <= ?1)
     )
     ${linkFilter}
     ORDER BY created_at ASC
     LIMIT 1`
  )
  const row = linkId
    ? await statement.bind(now, linkId).first<LinkRow>()
    : await statement.bind(now).first<LinkRow>()
  return row ?? null
}

const toExtractionJob = (
  row: LinkRow,
  leaseExpiresAt: number,
  dataVersion: number
): SavedLinkExtractionClaim => ({
  id: row.id,
  userId: row.user_id,
  url: row.url,
  metaJson: row.meta_json,
  title: row.title,
  extractionAttempts: row.extraction_attempts,
  leaseExpiresAt,
  dataVersion,
})

const createConditionalLinkStorageStatement = (
  database: D1Database,
  input: {
    userId: string
    linkId: string
    extractionState: LinkRow["extraction_state"]
    extractionAttempts: number
    leaseExpiresAt: number | null
    deltaBytes: number
    now: number
  }
): D1PreparedStatement =>
  database
    .prepare(
      `UPDATE storage_ledgers SET ${LEDGER_DOMAIN_COLUMNS.linkBytes} = ${LEDGER_DOMAIN_COLUMNS.linkBytes} + ?2, total_enforced_bytes = total_enforced_bytes + ?3, updated_at = ?4
       WHERE user_id = ?1
         AND EXISTS (
           SELECT 1 FROM links
           WHERE id = ?5
             AND user_id = ?1
             AND extraction_state = ?6
             AND extraction_attempts = ?7
             AND ((?8 IS NULL AND extraction_lease_expires_at IS NULL) OR extraction_lease_expires_at = ?8)
         )`
    )
    .bind(
      input.userId,
      input.deltaBytes,
      input.deltaBytes,
      input.now,
      input.linkId,
      input.extractionState,
      input.extractionAttempts,
      input.leaseExpiresAt
    )

const getCandidateReadinessCondition = (candidate: LinkRow): string =>
  candidate.extraction_state === "queued"
    ? "(extraction_available_at IS NULL OR extraction_available_at <= ?8)"
    : "extraction_lease_expires_at <= ?8"

export const claimNextSavedLinkExtraction = async (
  database: D1Database,
  input: { now: number; linkId?: string }
): Promise<SavedLinkExtractionClaim | undefined> => {
  const candidate = await findNextExtractionCandidate(
    database,
    input.now,
    input.linkId
  )
  if (!candidate) {
    return undefined
  }

  const nextAttempts = candidate.extraction_attempts + 1
  const leaseExpiresAt = input.now + LINK_EXTRACTION_LEASE_MS
  const nextRow: LinkRow = {
    ...candidate,
    extraction_state: "running",
    extraction_error: null,
    extraction_attempts: nextAttempts,
    extraction_available_at: null,
    extraction_lease_expires_at: leaseExpiresAt,
  }
  const preparation = await ensureStorageLedger(
    database,
    candidate.user_id,
    input.now
  )
  assertLinkSize(byteLength(nextRow))
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "linkBytes",
      currentBytes: byteLength(candidate),
      nextBytes: byteLength(nextRow),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  const operationId = `link-extraction:claim:${candidate.id}:${nextAttempts}`
  const { dataVersion, statementResults } = await executeOwnedWrite(
    database,
    candidate.user_id,
    [
      ...preparation.statements,
      database
        .prepare(
          `UPDATE links SET extraction_state = 'running', extraction_error = NULL, extraction_attempts = ?3, extraction_available_at = NULL, extraction_lease_expires_at = ?4, updated_at = ?5
           WHERE id = ?1
             AND user_id = ?2
             AND extraction_state = ?6
             AND extraction_attempts = ?7
             AND ${getCandidateReadinessCondition(candidate)}`
        )
        .bind(
          candidate.id,
          candidate.user_id,
          nextAttempts,
          leaseExpiresAt,
          input.now,
          candidate.extraction_state,
          candidate.extraction_attempts,
          input.now
        ),
      createConditionalLinkStorageStatement(database, {
        userId: candidate.user_id,
        linkId: candidate.id,
        extractionState: nextRow.extraction_state,
        extractionAttempts: nextRow.extraction_attempts,
        leaseExpiresAt: nextRow.extraction_lease_expires_at,
        deltaBytes: ledgerMutation.deltaBytes,
        now: input.now,
      }),
      createConditionalSavedLinkCommandOperationStatement(database, {
        userId: candidate.user_id,
        operationId,
        linkId: candidate.id,
        command: "link-extraction-claim",
        now: input.now,
        extractionState: nextRow.extraction_state,
        extractionAttempts: nextRow.extraction_attempts,
        leaseExpiresAt: nextRow.extraction_lease_expires_at,
      }),
    ],
    {
      conditionSql:
        "SELECT 1 FROM links WHERE id = ?2 AND user_id = ?1 AND extraction_state = ?3 AND extraction_attempts = ?4 AND extraction_lease_expires_at = ?5",
      conditionBindings: [
        candidate.id,
        nextRow.extraction_state,
        nextAttempts,
        leaseExpiresAt,
      ],
    }
  )
  const updateResult = statementResults[preparation.statements.length]
  if ((updateResult?.meta.changes ?? 0) === 0) {
    return undefined
  }
  return toExtractionJob(nextRow, leaseExpiresAt, dataVersion)
}

export const settleSavedLinkExtraction = async (
  database: D1Database,
  userId: string,
  input: {
    operationId: string
    id: string
    leaseExpiresAt: number
    state: "complete" | "failed"
    meta?: MetaData
    extractedLinks?: ExtractedLink[]
    error?: string
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
  const existingRow = await findSavedLinkById(database, input.id)
  if (
    !existingRow ||
    existingRow.user_id !== userId ||
    existingRow.extraction_state !== "running" ||
    existingRow.extraction_lease_expires_at !== input.leaseExpiresAt
  ) {
    return {
      success: false,
      replayed: false,
      dataVersion: await getDataVersion(database, userId),
    }
  }

  let nextRow: LinkRow
  if (input.state === "complete") {
    const previousMetadata = parseCanonicalLinkMetadataJson(
      existingRow.meta_json ?? EMPTY_LINK_METADATA_JSON
    )
    const metadata = createLinkMetadata({
      meta: input.meta ?? {},
      extractedLinks: input.extractedLinks ?? [],
      previous: previousMetadata,
    })
    nextRow = {
      ...existingRow,
      title: input.meta
        ? getLinkTitle(existingRow.url, input.meta)
        : existingRow.title,
      meta_json: JSON.stringify(metadata),
      updated_at: input.now,
      extraction_state: "complete",
      extraction_error: null,
      extraction_available_at: null,
      extraction_lease_expires_at: null,
    }
  } else {
    nextRow = {
      ...existingRow,
      updated_at: input.now,
      extraction_state: "failed",
      extraction_error: input.error ?? "Unable to load links.",
      extraction_available_at: null,
      extraction_lease_expires_at: null,
    }
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
  const { dataVersion, statementResults } = await executeOwnedWrite(
    database,
    userId,
    [
      ...preparation.statements,
      database
        .prepare(
          "UPDATE links SET title = ?3, meta_json = ?4, updated_at = ?5, extraction_state = ?6, extraction_error = ?7, extraction_available_at = NULL, extraction_lease_expires_at = NULL WHERE id = ?1 AND user_id = ?2 AND extraction_state = 'running' AND extraction_attempts = ?8 AND extraction_lease_expires_at = ?9"
        )
        .bind(
          nextRow.id,
          userId,
          nextRow.title,
          nextRow.meta_json,
          nextRow.updated_at,
          nextRow.extraction_state,
          nextRow.extraction_error,
          existingRow.extraction_attempts,
          input.leaseExpiresAt
        ),
      createConditionalLinkStorageStatement(database, {
        userId,
        linkId: nextRow.id,
        extractionState: nextRow.extraction_state,
        extractionAttempts: nextRow.extraction_attempts,
        leaseExpiresAt: nextRow.extraction_lease_expires_at,
        deltaBytes: ledgerMutation.deltaBytes,
        now: input.now,
      }),
      createConditionalSavedLinkCommandOperationStatement(database, {
        userId,
        operationId: input.operationId,
        linkId: nextRow.id,
        command: "link-extraction-settle",
        now: input.now,
        extractionState: nextRow.extraction_state,
        extractionAttempts: nextRow.extraction_attempts,
        leaseExpiresAt: nextRow.extraction_lease_expires_at,
      }),
    ],
    {
      conditionSql:
        "SELECT 1 FROM links WHERE id = ?2 AND user_id = ?1 AND extraction_state = ?3 AND extraction_attempts = ?4 AND extraction_lease_expires_at IS NULL",
      conditionBindings: [
        nextRow.id,
        nextRow.extraction_state,
        existingRow.extraction_attempts,
      ],
    }
  )
  const updateResult = statementResults[preparation.statements.length]
  return {
    success: (updateResult?.meta.changes ?? 0) > 0,
    replayed: false,
    dataVersion,
  }
}

export const requeuePendingSavedLinkExtraction = async (
  database: D1Database,
  userId: string,
  input: {
    operationId: string
    id: string
    leaseExpiresAt: number
    retryAfterSeconds: number
    now: number
  }
): Promise<SavedLinkMutationResult> => {
  const existingRow = await findSavedLinkById(database, input.id)
  if (
    !existingRow ||
    existingRow.user_id !== userId ||
    existingRow.extraction_state !== "running" ||
    existingRow.extraction_lease_expires_at !== input.leaseExpiresAt
  ) {
    return {
      success: false,
      replayed: false,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const retryDelayMs =
    Math.min(
      Math.max(input.retryAfterSeconds, 1),
      LINK_EXTRACTION_MAX_PENDING_RETRY_SECONDS
    ) * 1000
  const nextRow: LinkRow = {
    ...existingRow,
    updated_at: input.now,
    extraction_state: "queued",
    extraction_error: null,
    extraction_available_at: input.now + retryDelayMs,
    extraction_lease_expires_at: null,
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
          "UPDATE links SET extraction_state = 'queued', extraction_error = NULL, extraction_available_at = ?3, extraction_lease_expires_at = NULL, updated_at = ?4 WHERE id = ?1 AND user_id = ?2 AND extraction_state = 'running' AND extraction_lease_expires_at = ?5"
        )
        .bind(
          nextRow.id,
          userId,
          nextRow.extraction_available_at,
          input.now,
          input.leaseExpiresAt
        ),
      createConditionalLinkStorageStatement(database, {
        userId,
        linkId: nextRow.id,
        extractionState: nextRow.extraction_state,
        extractionAttempts: nextRow.extraction_attempts,
        leaseExpiresAt: nextRow.extraction_lease_expires_at,
        deltaBytes: ledgerMutation.deltaBytes,
        now: input.now,
      }),
      createConditionalSavedLinkCommandOperationStatement(database, {
        userId,
        operationId: input.operationId,
        linkId: nextRow.id,
        command: "link-extraction-pending",
        now: input.now,
        extractionState: nextRow.extraction_state,
        extractionAttempts: nextRow.extraction_attempts,
        leaseExpiresAt: nextRow.extraction_lease_expires_at,
      }),
    ],
    {
      conditionSql:
        "SELECT 1 FROM links WHERE id = ?2 AND user_id = ?1 AND extraction_state = ?3 AND extraction_attempts = ?4 AND extraction_available_at = ?5 AND extraction_lease_expires_at IS NULL",
      conditionBindings: [
        nextRow.id,
        nextRow.extraction_state,
        nextRow.extraction_attempts,
        nextRow.extraction_available_at,
      ],
    }
  )
  return { success: changed, replayed: false, dataVersion }
}

export const getSavedLinkQueueError = (error: Error): string => {
  const errorMessage = error.message.toLowerCase()
  if (
    errorMessage.includes("credential") ||
    errorMessage.includes("plugin") ||
    errorMessage.includes("configuration") ||
    errorMessage.includes("sign in")
  ) {
    return "Set up this source to load the link."
  }
  return "Unable to load links."
}
