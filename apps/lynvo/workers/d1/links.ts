import {
  mergeUnique,
  removeLinkFromTree,
} from "../../app/features/links/link-tree-metadata"
import {
  DAY_MS,
  DEFAULT_RETENTION_DAYS,
  LINK_RETENTION_BATCH_SIZE,
  LINKS_MAX_COUNT,
  RETENTION_SWEEP_MAX_BATCHES_PER_RUN,
  SAVED_LINK_COMMAND_OPERATION_CLEANUP_BATCH_SIZE,
  SAVED_LINK_OPTIMISTIC_RETRY_ATTEMPTS,
} from "../constants"
import {
  extractedLinkSchema,
  parseCanonicalLinkMetadataJson,
} from "../../app/features/links/storage-schemas"
import type {
  ExtractedLink,
  LinkMetadata,
} from "../../app/features/links/types"
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
import {
  createConditionalDeleteSavedLinkExtractionCredentialStatement,
  createUpsertSavedLinkExtractionCredentialStatement,
  type SavedLinkExtractionCredentialLinkState,
  type SavedLinkExtractionCredentialWrite,
} from "./saved-link-extraction-credentials"

export interface SavedLinkRecord {
  id: string
  url: string
  title: string | null
  metaJson: string
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
  | {
      kind: "setArtwork"
      providerId: number
      title: string
      year?: number
      mediaKind?: "movie" | "tv"
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

interface ResolvedMirrorsByUrl {
  [lazyItemUrl: string]: ExtractedLink[]
}

interface SavedLinkMetadataWriteInput {
  database: D1Database
  userId: string
  operationId: string
  existingRow: LinkRow
  nextRow: LinkRow
  now: number
}

interface CreateOrUpdateSavedLinkInput {
  operationId: string
  url: string
  title?: string | undefined
  meta: string
  extractionState?: "queued" | undefined
  extractionCredential?: SavedLinkExtractionCredentialWrite | null
  now: number
}

interface CreateOrUpdateSavedLinkAttemptInput {
  database: D1Database
  userId: string
  input: CreateOrUpdateSavedLinkInput
  metadataJson: string
  extractionState: "queued" | "complete"
  retentionDays: number
}

interface CreateOrUpdateSavedLinkAttemptResult {
  id: string
  dataVersion: number
  changed: boolean
}

interface RunCreateOrUpdateSavedLinkAttemptsInput {
  database: D1Database
  userId: string
  operationId: string
  attempt: () => Promise<CreateOrUpdateSavedLinkAttemptResult>
}

interface ExecuteCreateOrUpdateSavedLinkAttemptInput {
  database: D1Database
  userId: string
  operationId: string
  attemptIndex: number
  attempt: () => Promise<CreateOrUpdateSavedLinkAttemptResult>
}

interface UpdateExistingSavedLinkInput {
  database: D1Database
  userId: string
  input: CreateOrUpdateSavedLinkInput
  existingRow: LinkRow
  metadataJson: string
  extractionState: "queued" | "complete"
  retentionDays: number
}

interface InsertNewSavedLinkInput {
  database: D1Database
  userId: string
  input: CreateOrUpdateSavedLinkInput
  metadataJson: string
  extractionState: "queued" | "complete"
  retentionDays: number
}

interface CreateNewSavedLinkRowInput {
  userId: string
  input: CreateOrUpdateSavedLinkInput
  metadataJson: string
  extractionState: "queued" | "complete"
  retentionDays: number
}

interface GetOldestSavedLinkInput {
  database: D1Database
  userId: string
  userLinkCount: number
}

interface SavedLinkMutationReservationInput {
  operationId: string
  command: string
  now: number
}

interface SavedLinkOptimisticMutationAttemptResult {
  dataVersion: number
  changed: boolean
}

interface RunSavedLinkOptimisticMutationInput {
  database: D1Database
  userId: string
  operationId: string
  attempt: () => Promise<SavedLinkOptimisticMutationAttemptResult>
}

interface SavedLinkOptimisticMutationStepInput extends RunSavedLinkOptimisticMutationInput {
  attemptsRemaining: number
}

interface UpdateSavedLinkMetaInput {
  operationId: string
  id: string
  meta: string
  now: number
}

interface UpdateSavedLinkMetaAttemptInput {
  database: D1Database
  userId: string
  input: UpdateSavedLinkMetaInput
  metadataJson: string
}

interface ApplySavedLinkMetadataOperationInput {
  operationId: string
  id: string
  operation: SavedLinkMetadataOperation
  now: number
}

interface ClearSavedLinksInput {
  operationId: string
  now: number
}

const toSavedLinkExtractionCredentialLinkState = (
  row: LinkRow
): SavedLinkExtractionCredentialLinkState => ({
  url: row.url,
  extractionState: row.extraction_state,
  extractionAttempts: row.extraction_attempts,
  extractionLeaseExpiresAt: row.extraction_lease_expires_at,
  updatedAt: row.updated_at,
  metaJson: row.meta_json,
})

interface ClearSavedLinksResult {
  success: boolean
  replayed: boolean
  deletedLinks: number
  dataVersion: number
}

interface ExpiredLinkUserSummary {
  userId: string
  totalBytes: number
  linkCount: number
}

interface PreparedExpiredLinkUserMutation {
  statements: D1PreparedStatement[]
  dataVersionStatement: D1PreparedStatement
}

interface ExpiredLinkBatchOutcome {
  deletedLinks: number
  continued: boolean
}

const parseExtractedLinks = (serializedLinks: string): ExtractedLink[] => [
  ...Schema.decodeUnknownSync(Schema.Array(extractedLinkSchema))(
    JSON.parse(serializedLinks)
  ),
]

const applyMarkOpened = (
  metadata: LinkMetadata,
  operation: Extract<SavedLinkMetadataOperation, { kind: "markOpened" }>
): void => {
  metadata.playback.openedUrls = mergeUnique(metadata.playback.openedUrls, [
    operation.linkUrl,
  ])
}

const applySetArtwork = (
  metadata: LinkMetadata,
  operation: Extract<SavedLinkMetadataOperation, { kind: "setArtwork" }>
): void => {
  metadata.artwork = {
    providerId: operation.providerId,
    title: operation.title,
    year: operation.year,
    mediaKind: operation.mediaKind,
  }
}

const pruneFreshMirrors = (
  resolvedMirrors: Readonly<ResolvedMirrorsByUrl>,
  isMirrorFresh: (mirror: ExtractedLink) => boolean
): ResolvedMirrorsByUrl => {
  const prunedResolvedMirrors: ResolvedMirrorsByUrl = {}
  for (const [lazyItemUrl, cachedMirrors] of Object.entries(resolvedMirrors)) {
    const freshCachedMirrors = cachedMirrors.filter(isMirrorFresh)
    if (freshCachedMirrors.length > 0) {
      prunedResolvedMirrors[lazyItemUrl] = freshCachedMirrors
    }
  }
  return prunedResolvedMirrors
}

const applyCacheMirrors = (
  metadata: LinkMetadata,
  operation: Extract<SavedLinkMetadataOperation, { kind: "cacheMirrors" }>,
  now: number
): void => {
  const mirrors = parseExtractedLinks(operation.mirrorsJson)
  const isMirrorFresh = (mirror: ExtractedLink): boolean =>
    mirror.expiry === undefined || mirror.expiry > now
  const prunedResolvedMirrors = pruneFreshMirrors(
    metadata.playback.resolvedMirrors ?? {},
    isMirrorFresh
  )
  const freshMirrors = mirrors.filter(isMirrorFresh)
  if (freshMirrors.length > 0) {
    prunedResolvedMirrors[operation.lazyItemUrl] = freshMirrors
  }
  metadata.playback.resolvedMirrors = prunedResolvedMirrors
}

const applyRemoveExtractedLink = (
  metadata: LinkMetadata,
  operation: Extract<
    SavedLinkMetadataOperation,
    { kind: "removeExtractedLink" }
  >
): void => {
  metadata.extraction.extractedLinks = removeLinkFromTree(
    metadata.extraction.extractedLinks,
    operation.linkKey
  )
  metadata.playback.openedUrls = metadata.playback.openedUrls.filter(
    (openedUrl) => openedUrl !== operation.linkUrl
  )
}

const applyReplaceExtraction = (
  metadata: LinkMetadata,
  operation: Extract<SavedLinkMetadataOperation, { kind: "replaceExtraction" }>
): void => {
  const currentExtractionJson = JSON.stringify(
    metadata.extraction.extractedLinks
  )
  if (currentExtractionJson !== operation.expectedExtractionJson) {
    throw new Error("Saved link extraction changed; refresh and retry")
  }
  metadata.extraction.extractedLinks = parseExtractedLinks(
    operation.extractedLinksJson
  )
  metadata.playback.resolvedMirrors = {}
}

const applySavedLinkMetadataOperationToMetadata = (
  metadata: LinkMetadata,
  operation: SavedLinkMetadataOperation,
  now: number
): void => {
  switch (operation.kind) {
    case "markOpened":
      return applyMarkOpened(metadata, operation)
    case "setArtwork":
      return applySetArtwork(metadata, operation)
    case "cacheMirrors":
      return applyCacheMirrors(metadata, operation, now)
    case "removeExtractedLink":
      return applyRemoveExtractedLink(metadata, operation)
    case "replaceExtraction":
      return applyReplaceExtraction(metadata, operation)
  }
}

interface CreateSavedLinkMetadataNextRowInput {
  existingRow: LinkRow
  metadata: LinkMetadata
  operation: SavedLinkMetadataOperation
  now: number
}

const createSavedLinkMetadataNextRow = ({
  existingRow,
  metadata,
  operation,
  now,
}: CreateSavedLinkMetadataNextRowInput): LinkRow => {
  const isExtractionReplacement = operation.kind === "replaceExtraction"
  return {
    ...existingRow,
    meta_json: JSON.stringify(metadata),
    updated_at: now,
    extraction_state: isExtractionReplacement
      ? "complete"
      : existingRow.extraction_state,
    extraction_error: isExtractionReplacement
      ? null
      : existingRow.extraction_error,
    extraction_available_at: isExtractionReplacement
      ? null
      : existingRow.extraction_available_at,
    extraction_lease_expires_at: isExtractionReplacement
      ? null
      : existingRow.extraction_lease_expires_at,
  }
}

const executeSavedLinkMetadataWrite = async ({
  database,
  userId,
  operationId,
  existingRow,
  nextRow,
  now,
}: SavedLinkMetadataWriteInput): Promise<{
  dataVersion: number
  changed: boolean
}> => {
  const preparation = await ensureStorageLedger(database, userId, now)
  assertLinkSize(byteLength(nextRow))
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "linkBytes",
      currentBytes: byteLength(existingRow),
      nextBytes: byteLength(nextRow),
      savedLinkCountDelta: 0,
    },
    now,
  })
  return executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      database
        .prepare(
          "UPDATE links SET meta_json = ?2, updated_at = ?3, extraction_state = ?4, extraction_error = ?5, extraction_available_at = ?6, extraction_lease_expires_at = ?7 WHERE id = ?1 AND meta_json IS ?8"
        )
        .bind(
          existingRow.id,
          nextRow.meta_json,
          now,
          nextRow.extraction_state,
          nextRow.extraction_error,
          nextRow.extraction_available_at,
          nextRow.extraction_lease_expires_at,
          existingRow.meta_json
        ),
      ...ledgerMutation.statements,
      createReservedSavedLinkOperationLinkStatement(database, {
        userId,
        operationId,
        linkId: existingRow.id,
      }),
    ],
  })
}

const canonicalizeLinkMetadataJson = (metadataJson: string): string =>
  JSON.stringify(parseCanonicalLinkMetadataJson(metadataJson))

const executeUpdateSavedLinkMetaAttempt = async ({
  database,
  userId,
  input,
  metadataJson,
}: UpdateSavedLinkMetaAttemptInput): Promise<SavedLinkOptimisticMutationAttemptResult> => {
  const existingRow = await requireOwnedSavedLink(database, userId, input.id)
  const nextRow: LinkRow = {
    ...existingRow,
    meta_json: metadataJson,
    updated_at: input.now,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  assertLinkSize(byteLength(nextRow))
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "linkBytes",
      currentBytes: byteLength(existingRow),
      nextBytes: byteLength(nextRow),
      savedLinkCountDelta: 0,
    },
    now: input.now,
  })
  return executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      database
        .prepare(
          "UPDATE links SET meta_json = ?2, updated_at = ?3 WHERE id = ?1 AND meta_json IS ?4"
        )
        .bind(existingRow.id, metadataJson, input.now, existingRow.meta_json),
      ...ledgerMutation.statements,
      createReservedSavedLinkOperationLinkStatement(database, {
        userId,
        operationId: input.operationId,
        linkId: existingRow.id,
      }),
    ],
  })
}

const executeApplySavedLinkMetadataAttempt = async (
  database: D1Database,
  userId: string,
  input: ApplySavedLinkMetadataOperationInput
): Promise<SavedLinkOptimisticMutationAttemptResult> => {
  const existingRow = await requireOwnedSavedLink(database, userId, input.id)
  const metadata = parseCanonicalLinkMetadataJson(existingRow.meta_json)
  applySavedLinkMetadataOperationToMetadata(
    metadata,
    input.operation,
    input.now
  )
  const nextRow = createSavedLinkMetadataNextRow({
    existingRow,
    metadata,
    operation: input.operation,
    now: input.now,
  })
  return executeSavedLinkMetadataWrite({
    database,
    userId,
    operationId: input.operationId,
    existingRow,
    nextRow,
    now: input.now,
  })
}

const executeDeleteSavedLink = async (
  database: D1Database,
  userId: string,
  input: { operationId: string; id: string; now: number }
): Promise<SavedLinkMutationResult> => {
  const existingRow = await requireOwnedSavedLink(database, userId, input.id)
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "linkBytes",
      currentBytes: byteLength(existingRow),
      nextBytes: 0,
      savedLinkCountDelta: -1,
    },
    now: input.now,
  })
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      database
        .prepare(
          "DELETE FROM saved_link_extraction_credentials WHERE link_id = ?1"
        )
        .bind(existingRow.id),
      database.prepare("DELETE FROM links WHERE id = ?1").bind(existingRow.id),
      ...ledgerMutation.statements,
    ],
  })
  return { success: true, replayed: false, dataVersion }
}

const executeClearSavedLinks = async (
  database: D1Database,
  userId: string,
  input: ClearSavedLinksInput
): Promise<ClearSavedLinksResult> => {
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const { savedLinkCount } = preparation.ledger
  if (savedLinkCount === 0) {
    return {
      success: true,
      replayed: false,
      deletedLinks: 0,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "linkBytes",
      currentBytes: preparation.ledger.linkBytes,
      nextBytes: 0,
      savedLinkCountDelta: -savedLinkCount,
    },
    now: input.now,
  })
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      database
        .prepare(
          "DELETE FROM saved_link_extraction_credentials WHERE user_id = ?1"
        )
        .bind(userId),
      database.prepare("DELETE FROM links WHERE user_id = ?1").bind(userId),
      ...ledgerMutation.statements,
    ],
  })
  return {
    success: true,
    replayed: false,
    deletedLinks: savedLinkCount,
    dataVersion,
  }
}

const reserveSavedLinkMutation = async (
  database: D1Database,
  userId: string,
  input: SavedLinkMutationReservationInput
): Promise<SavedLinkMutationResult | undefined> => {
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
    command: input.command,
    now: input.now,
  })
  if (!reserved) {
    return {
      success: true,
      replayed: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  return undefined
}

const reserveCreateOrUpdateSavedLink = async (
  database: D1Database,
  userId: string,
  input: CreateOrUpdateSavedLinkInput
): Promise<SavedLinkCommandResult | undefined> => {
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
    const concurrentOperation = await findCompletedSavedLinkOperation(
      database,
      userId,
      input.operationId
    )
    return {
      id: concurrentOperation?.linkId ?? null,
      replayed: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  return undefined
}

const attemptNextSavedLinkOptimisticMutation = async ({
  database,
  userId,
  operationId,
  attempt,
  attemptsRemaining,
}: SavedLinkOptimisticMutationStepInput): Promise<SavedLinkMutationResult> => {
  try {
    const result = await attempt()
    if (result.changed) {
      return {
        success: true,
        replayed: false,
        dataVersion: result.dataVersion,
      }
    }
  } catch (error) {
    await releaseReservedSavedLinkCommandOperation(database, {
      userId,
      operationId,
    })
    throw error
  }
  if (attemptsRemaining <= 1) {
    await releaseReservedSavedLinkCommandOperation(database, {
      userId,
      operationId,
    })
    return {
      success: false,
      replayed: false,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  return attemptNextSavedLinkOptimisticMutation({
    database,
    userId,
    operationId,
    attempt,
    attemptsRemaining: attemptsRemaining - 1,
  })
}

const runSavedLinkOptimisticMutation = async ({
  database,
  userId,
  operationId,
  attempt,
}: RunSavedLinkOptimisticMutationInput): Promise<SavedLinkMutationResult> =>
  attemptNextSavedLinkOptimisticMutation({
    database,
    userId,
    operationId,
    attempt,
    attemptsRemaining: SAVED_LINK_OPTIMISTIC_RETRY_ATTEMPTS,
  })

const updateExistingSavedLink = async ({
  database,
  userId,
  input,
  existingRow,
  metadataJson,
  extractionState,
  retentionDays,
}: UpdateExistingSavedLinkInput): Promise<CreateOrUpdateSavedLinkAttemptResult> => {
  const nextRow: LinkRow = {
    ...existingRow,
    title: input.title ?? existingRow.title,
    meta_json: metadataJson,
    updated_at: input.now,
    expires_at: input.now + retentionDays * DAY_MS,
    extraction_state: extractionState,
    extraction_error: null,
    extraction_attempts:
      extractionState === "queued" ? 0 : existingRow.extraction_attempts,
    extraction_available_at: extractionState === "queued" ? input.now : null,
    extraction_lease_expires_at: null,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  assertLinkSize(byteLength(nextRow))
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "linkBytes",
      currentBytes: byteLength(existingRow),
      nextBytes: byteLength(nextRow),
      savedLinkCountDelta: 0,
    },
    now: input.now,
  })
  const extractionCredentialStatement =
    extractionState === "queued" && input.extractionCredential
      ? createUpsertSavedLinkExtractionCredentialStatement({
          database,
          userId,
          linkId: existingRow.id,
          operationId: input.operationId,
          targetUrl: input.extractionCredential.targetUrl,
          credential: input.extractionCredential,
          expectedLink: toSavedLinkExtractionCredentialLinkState(nextRow),
        })
      : createConditionalDeleteSavedLinkExtractionCredentialStatement({
          database,
          userId,
          linkId: existingRow.id,
          operationId: input.operationId,
          targetUrl: nextRow.url,
          expectedLink: toSavedLinkExtractionCredentialLinkState(nextRow),
        })
  const { dataVersion, changed } = await executeOwnedWrite({
    database,
    userId,
    statements: [
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
      extractionCredentialStatement,
    ],
  })
  return { id: existingRow.id, dataVersion, changed }
}

const getOldestSavedLinkIfAtCapacity = async ({
  database,
  userId,
  userLinkCount,
}: GetOldestSavedLinkInput): Promise<LinkRow | undefined> => {
  if (userLinkCount < LINKS_MAX_COUNT) {
    return undefined
  }
  return (
    (await database
      .prepare(
        `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE user_id = ?1 ORDER BY created_at ASC LIMIT 1`
      )
      .bind(userId)
      .first<LinkRow>()) ?? undefined
  )
}

const createNewSavedLinkRow = ({
  userId,
  input,
  metadataJson,
  extractionState,
  retentionDays,
}: CreateNewSavedLinkRowInput): LinkRow => ({
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
  extraction_available_at: extractionState === "queued" ? input.now : null,
  extraction_lease_expires_at: null,
})

const insertNewSavedLink = async ({
  database,
  userId,
  input,
  metadataJson,
  extractionState,
  retentionDays,
}: InsertNewSavedLinkInput): Promise<CreateOrUpdateSavedLinkAttemptResult> => {
  const countRow = await database
    .prepare("SELECT COUNT(*) AS count FROM links WHERE user_id = ?1")
    .bind(userId)
    .first<{ count: number }>()
  const userLinkCount = countRow?.count ?? 0
  const oldestRow = await getOldestSavedLinkIfAtCapacity({
    database,
    userId,
    userLinkCount,
  })
  const newRow = createNewSavedLinkRow({
    userId,
    input,
    metadataJson,
    extractionState,
    retentionDays,
  })
  const preparation = await ensureStorageLedger(database, userId, input.now)
  assertLinkSize(byteLength(newRow))
  const evictionMutation = oldestRow
    ? applyStorageMutation({
        database,
        preparation,
        plan: {
          domain: "linkBytes",
          currentBytes: byteLength(oldestRow),
          nextBytes: 0,
          savedLinkCountDelta: -1,
        },
        now: input.now,
      })
    : undefined
  const insertionMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "linkBytes",
      currentBytes: 0,
      nextBytes: byteLength(newRow),
      savedLinkCountDelta: 1,
    },
    now: input.now,
  })
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      ...(oldestRow
        ? [
            database
              .prepare(
                "DELETE FROM saved_link_extraction_credentials WHERE link_id = ?1"
              )
              .bind(oldestRow.id),
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
      ...(extractionState === "queued" && input.extractionCredential
        ? [
            createUpsertSavedLinkExtractionCredentialStatement({
              database,
              userId,
              linkId: newRow.id,
              operationId: input.operationId,
              targetUrl: input.extractionCredential.targetUrl,
              credential: input.extractionCredential,
              expectedLink: toSavedLinkExtractionCredentialLinkState(newRow),
            }),
          ]
        : []),
    ],
  })
  return { id: newRow.id, dataVersion, changed: true }
}

const createOrUpdateSavedLinkAttempt = async ({
  database,
  userId,
  input,
  metadataJson,
  extractionState,
  retentionDays,
}: CreateOrUpdateSavedLinkAttemptInput): Promise<CreateOrUpdateSavedLinkAttemptResult> => {
  const existingRow = await database
    .prepare(
      `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE user_id = ?1 AND url = ?2`
    )
    .bind(userId, input.url)
    .first<LinkRow>()
  if (existingRow) {
    return updateExistingSavedLink({
      database,
      userId,
      input,
      existingRow,
      metadataJson,
      extractionState,
      retentionDays,
    })
  }
  return insertNewSavedLink({
    database,
    userId,
    input,
    metadataJson,
    extractionState,
    retentionDays,
  })
}

const isConcurrentCreateConflict = (error: Error): boolean =>
  error.message.includes("UNIQUE constraint failed: links.url")

const executeCreateOrUpdateSavedLinkAttempt = async ({
  database,
  userId,
  operationId,
  attemptIndex,
  attempt,
}: ExecuteCreateOrUpdateSavedLinkAttemptInput): Promise<
  CreateOrUpdateSavedLinkAttemptResult | undefined
> => {
  try {
    return await attempt()
  } catch (error) {
    if (
      attemptIndex === 0 &&
      error instanceof Error &&
      isConcurrentCreateConflict(error)
    ) {
      return undefined
    }
    await releaseReservedSavedLinkCommandOperation(database, {
      userId,
      operationId,
    })
    throw error
  }
}

const runNextCreateOrUpdateSavedLinkAttempt = async ({
  database,
  userId,
  operationId,
  attemptIndex,
  attempt,
}: ExecuteCreateOrUpdateSavedLinkAttemptInput): Promise<SavedLinkCommandResult> => {
  const result = await executeCreateOrUpdateSavedLinkAttempt({
    database,
    userId,
    operationId,
    attemptIndex,
    attempt,
  })
  if (result?.changed) {
    return {
      id: result.id,
      replayed: false,
      dataVersion: result.dataVersion,
    }
  }
  if (attemptIndex + 1 >= SAVED_LINK_OPTIMISTIC_RETRY_ATTEMPTS) {
    await releaseReservedSavedLinkCommandOperation(database, {
      userId,
      operationId,
    })
    throw new Error("Saved link changed while saving; retry")
  }
  return runNextCreateOrUpdateSavedLinkAttempt({
    database,
    userId,
    operationId,
    attemptIndex: attemptIndex + 1,
    attempt,
  })
}

const runCreateOrUpdateSavedLinkAttempts = async ({
  database,
  userId,
  operationId,
  attempt,
}: RunCreateOrUpdateSavedLinkAttemptsInput): Promise<SavedLinkCommandResult> =>
  runNextCreateOrUpdateSavedLinkAttempt({
    database,
    userId,
    operationId,
    attemptIndex: 0,
    attempt,
  })

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

interface CountExpiredLinksForUserInput {
  database: D1Database
  userId: string
  retentionDays: number
  now: number
}

export const countExpiredLinksForUser = async ({
  database,
  userId,
  retentionDays,
  now,
}: CountExpiredLinksForUserInput): Promise<number> => {
  const row = await database
    .prepare(
      "SELECT COUNT(*) AS expired FROM links WHERE user_id = ?1 AND created_at < ?2"
    )
    .bind(userId, getRetentionCutoff(now, retentionDays))
    .first<{ expired: number }>()
  return row?.expired ?? 0
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
  input: CreateOrUpdateSavedLinkInput
): Promise<SavedLinkCommandResult> => {
  const replayed = await reserveCreateOrUpdateSavedLink(database, userId, input)
  if (replayed) {
    return replayed
  }
  const retentionDays = await getUserRetentionDays(database, userId)
  await deleteExpiredLinksForUser({
    database,
    userId,
    retentionDays,
    now: input.now,
  })

  const metadataJson = canonicalizeLinkMetadataJson(input.meta)
  const extractionState = input.extractionState ?? "complete"
  return runCreateOrUpdateSavedLinkAttempts({
    database,
    userId,
    operationId: input.operationId,
    attempt: () =>
      createOrUpdateSavedLinkAttempt({
        database,
        userId,
        input,
        metadataJson,
        extractionState,
        retentionDays,
      }),
  })
}

export const updateSavedLinkMeta = async (
  database: D1Database,
  userId: string,
  input: UpdateSavedLinkMetaInput
): Promise<SavedLinkMutationResult> => {
  const replayed = await reserveSavedLinkMutation(database, userId, {
    operationId: input.operationId,
    command: "update-meta",
    now: input.now,
  })
  if (replayed) {
    return replayed
  }
  const metadataJson = canonicalizeLinkMetadataJson(input.meta)
  return runSavedLinkOptimisticMutation({
    database,
    userId,
    operationId: input.operationId,
    attempt: () =>
      executeUpdateSavedLinkMetaAttempt({
        database,
        userId,
        input,
        metadataJson,
      }),
  })
}

export const applySavedLinkMetadataOperation = async (
  database: D1Database,
  userId: string,
  input: ApplySavedLinkMetadataOperationInput
): Promise<SavedLinkMutationResult> => {
  const replayed = await reserveSavedLinkMutation(database, userId, {
    operationId: input.operationId,
    command: "apply-metadata-operation",
    now: input.now,
  })
  if (replayed) {
    return replayed
  }
  return runSavedLinkOptimisticMutation({
    database,
    userId,
    operationId: input.operationId,
    attempt: () =>
      executeApplySavedLinkMetadataAttempt(database, userId, input),
  })
}

export const deleteSavedLinkById = async (
  database: D1Database,
  userId: string,
  input: { operationId: string; id: string; now: number }
): Promise<SavedLinkMutationResult> => {
  const replayed = await reserveSavedLinkMutation(database, userId, {
    operationId: input.operationId,
    command: "delete",
    now: input.now,
  })
  if (replayed) {
    return replayed
  }
  try {
    return await executeDeleteSavedLink(database, userId, input)
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
  input: ClearSavedLinksInput
): Promise<ClearSavedLinksResult> => {
  const replayed = await reserveSavedLinkMutation(database, userId, {
    operationId: input.operationId,
    command: "clear",
    now: input.now,
  })
  if (replayed) {
    return { ...replayed, deletedLinks: 0 }
  }
  try {
    return await executeClearSavedLinks(database, userId, input)
  } catch (error) {
    await releaseReservedSavedLinkCommandOperation(database, {
      userId,
      operationId: input.operationId,
    })
    throw error
  }
}

interface DeleteExpiredLinksForUserInput {
  database: D1Database
  userId: string
  retentionDays: number
  now: number
}

export const deleteExpiredLinksForUser = async ({
  database,
  userId,
  retentionDays,
  now,
}: DeleteExpiredLinksForUserInput): Promise<number> => {
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
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "linkBytes",
      currentBytes: totalBytes,
      nextBytes: 0,
      savedLinkCountDelta: -results.length,
    },
    now,
  })
  await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      database
        .prepare(
          `DELETE FROM saved_link_extraction_credentials WHERE link_id IN (${placeholders})`
        )
        .bind(...results.map((row) => row.id)),
      database
        .prepare(`DELETE FROM links WHERE id IN (${placeholders})`)
        .bind(...results.map((row) => row.id)),
      ...ledgerMutation.statements,
    ],
  })
  return results.length
}

const loadExpiredLinkBatch = async (
  database: D1Database,
  now: number
): Promise<LinkRow[] | undefined> => {
  const { results } = await database
    .prepare(
      `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE expires_at IS NOT NULL AND expires_at <= ?1 LIMIT ?2`
    )
    .bind(now, LINK_RETENTION_BATCH_SIZE)
    .all<LinkRow>()
  return results.length === 0 ? undefined : results
}

const summarizeExpiredLinksByUser = (
  rows: readonly LinkRow[]
): ExpiredLinkUserSummary[] => {
  const summariesByUser = new Map<string, ExpiredLinkUserSummary>()
  for (const row of rows) {
    const existingSummary = summariesByUser.get(row.user_id)
    if (existingSummary) {
      existingSummary.totalBytes += byteLength(row)
      existingSummary.linkCount += 1
      continue
    }
    summariesByUser.set(row.user_id, {
      userId: row.user_id,
      totalBytes: byteLength(row),
      linkCount: 1,
    })
  }
  return [...summariesByUser.values()]
}

const prepareExpiredLinkUserMutation = async (
  database: D1Database,
  summary: ExpiredLinkUserSummary,
  now: number
): Promise<PreparedExpiredLinkUserMutation> => {
  const preparation = await ensureStorageLedger(database, summary.userId, now)
  const ledgerMutation = applyStorageMutation({
    database,
    preparation,
    plan: {
      domain: "linkBytes",
      currentBytes: summary.totalBytes,
      nextBytes: 0,
      savedLinkCountDelta: -summary.linkCount,
    },
    now,
  })
  return {
    statements: [...preparation.statements, ...ledgerMutation.statements],
    dataVersionStatement: createDataVersionBumpStatement(
      database,
      summary.userId
    ),
  }
}

const prepareExpiredLinkBatchStatements = async (
  database: D1Database,
  rows: readonly LinkRow[],
  now: number
): Promise<{
  statements: D1PreparedStatement[]
  dataVersionStatements: D1PreparedStatement[]
}> => {
  const summaries = summarizeExpiredLinksByUser(rows)
  const preparedUsers = await Promise.all(
    summaries.map((summary) =>
      prepareExpiredLinkUserMutation(database, summary, now)
    )
  )
  const statements: D1PreparedStatement[] = []
  const dataVersionStatements: D1PreparedStatement[] = []
  for (const preparedUser of preparedUsers) {
    statements.push(...preparedUser.statements)
    dataVersionStatements.push(preparedUser.dataVersionStatement)
  }
  return { statements, dataVersionStatements }
}

const processExpiredLinkBatch = async (
  database: D1Database,
  now: number
): Promise<ExpiredLinkBatchOutcome | undefined> => {
  const rows = await loadExpiredLinkBatch(database, now)
  if (!rows) {
    return undefined
  }
  const { statements, dataVersionStatements } =
    await prepareExpiredLinkBatchStatements(database, rows, now)
  const placeholders = rows.map((_, index) => `?${index + 1}`).join(", ")
  statements.push(
    database
      .prepare(
        `DELETE FROM saved_link_extraction_credentials WHERE link_id IN (${placeholders})`
      )
      .bind(...rows.map((row) => row.id))
  )
  statements.push(
    database
      .prepare(`DELETE FROM links WHERE id IN (${placeholders})`)
      .bind(...rows.map((row) => row.id))
  )
  statements.push(...dataVersionStatements)
  await database.batch(statements)
  return {
    deletedLinks: rows.length,
    continued: rows.length === LINK_RETENTION_BATCH_SIZE,
  }
}

export interface RetentionSweepOutcome {
  deletedLinks: number
  continued: boolean
}

interface ExpiredLinkSweepState {
  database: D1Database
  now: number
  batchesRemaining: number
  deletedLinks: number
}

const sweepNextExpiredLinkBatch = async ({
  database,
  now,
  batchesRemaining,
  deletedLinks,
}: ExpiredLinkSweepState): Promise<RetentionSweepOutcome> => {
  if (batchesRemaining === 0) {
    return { deletedLinks, continued: true }
  }
  const batchOutcome = await processExpiredLinkBatch(database, now)
  if (!batchOutcome) {
    return { deletedLinks, continued: false }
  }
  const nextDeletedLinks = deletedLinks + batchOutcome.deletedLinks
  if (!batchOutcome.continued) {
    return { deletedLinks: nextDeletedLinks, continued: false }
  }
  return sweepNextExpiredLinkBatch({
    database,
    now,
    batchesRemaining: batchesRemaining - 1,
    deletedLinks: nextDeletedLinks,
  })
}

export const sweepExpiredLinks = async (
  database: D1Database,
  now: number
): Promise<RetentionSweepOutcome> =>
  sweepNextExpiredLinkBatch({
    database,
    now,
    batchesRemaining: RETENTION_SWEEP_MAX_BATCHES_PER_RUN,
    deletedLinks: 0,
  })

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
