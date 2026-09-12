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
  type OwnedWriteResult,
} from "./data-version"
import {
  assertLinkSize,
  applyStorageMutation,
  byteLength,
  createClearSavedLinksLedgerStatement,
  ensureStorageLedger,
} from "./storage-ledger"
import { LINK_NOT_FOUND_MESSAGE } from "./errors"
import { createOpaqueId } from "./ids"
import type { LinkRow } from "./rows"
import {
  completeSavedLinkOperationIfNoSavedLinks,
  createSavedLinkDeleteClaimStatement,
  createSavedLinkDeleteCompletionStatement,
  createSavedLinkDeleteGuard,
  createSavedLinkDeleteLedgerCondition,
  createReservedSavedLinkOperationLinkStatement,
  createSavedLinkOperationCompletionStatement,
  findCompletedSavedLinkOperation,
  releaseReservedSavedLinkCommandOperation,
  requireOwnedSavedLink,
  reserveSavedLinkCommandOperation,
  SAVED_LINK_COLUMNS,
  type CompletedSavedLinkOperation,
  type SavedLinkCommandOperationKey,
} from "./saved-link-storage"
import { savedLinkMetaAppliedConditions } from "./saved-link-meta-applied"
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

type SavedLinkReservationOutcome =
  | {
      kind: "completed"
      operation: CompletedSavedLinkOperation
      dataVersion: number
    }
  | { kind: "inFlight"; dataVersion: number }

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

type OwnedLinkIdentity = Pick<LinkRow, "id" | "user_id">

const createOwnedLinkPredicate = (
  rows: readonly OwnedLinkIdentity[],
  idColumn: "id" | "link_id"
): string =>
  rows
    .map(
      (_, index) =>
        `(${idColumn} = ?${index * 2 + 1} AND user_id = ?${index * 2 + 2})`
    )
    .join(" OR ")

const createOwnedLinkDeletionStatements = (
  database: D1Database,
  rows: readonly OwnedLinkIdentity[]
): D1PreparedStatement[] => {
  const bindings = rows.flatMap((row) => [row.id, row.user_id])
  return [
    database
      .prepare(
        `DELETE FROM saved_link_extraction_credentials WHERE ${createOwnedLinkPredicate(rows, "link_id")}`
      )
      .bind(...bindings),
    database
      .prepare(
        `DELETE FROM links WHERE ${createOwnedLinkPredicate(rows, "id")}`
      )
      .bind(...bindings),
  ]
}

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

interface GuardedSavedLinkMetaWriteInput {
  readonly database: D1Database
  readonly userId: string
  readonly operationId: string
  readonly existingRow: LinkRow
  readonly nextRow: LinkRow
  readonly updateStatement: D1PreparedStatement
  readonly trailingStatement?: D1PreparedStatement
}

const executeGuardedSavedLinkMetaWrite = async ({
  database,
  userId,
  operationId,
  existingRow,
  nextRow,
  updateStatement,
  trailingStatement,
}: GuardedSavedLinkMetaWriteInput): Promise<OwnedWriteResult> => {
  // nextRow.updated_at is the write's clock: the ledger timestamps and the
  // applied-state guard both read it, so they cannot disagree with the
  // UPDATE statement's updated_at binding.
  const now = nextRow.updated_at
  const preparation = await ensureStorageLedger(database, userId, now)
  assertLinkSize(byteLength(nextRow))
  const applied = savedLinkMetaAppliedConditions({
    linkId: existingRow.id,
    metaJson: nextRow.meta_json,
    updatedAt: now,
  })
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
    condition: applied.ledgerCondition,
  })
  return executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      updateStatement,
      ...ledgerMutation.statements,
      createReservedSavedLinkOperationLinkStatement(database, {
        userId,
        operationId,
        linkId: existingRow.id,
        appliedLink: applied.appliedLink,
      }),
      ...(trailingStatement ? [trailingStatement] : []),
    ],
    guard: applied.guard,
  })
}

const canonicalizeLinkMetadataJson = (metadataJson: string): string =>
  JSON.stringify(parseCanonicalLinkMetadataJson(metadataJson))

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
  return executeGuardedSavedLinkMetaWrite({
    database,
    userId,
    operationId: input.operationId,
    existingRow,
    nextRow,
    updateStatement: database
      .prepare(
        "UPDATE links SET meta_json = ?3, updated_at = ?4, extraction_state = ?5, extraction_error = ?6, extraction_available_at = ?7, extraction_lease_expires_at = ?8 WHERE id = ?1 AND user_id = ?2 AND meta_json IS ?9"
      )
      .bind(
        existingRow.id,
        userId,
        nextRow.meta_json,
        nextRow.updated_at,
        nextRow.extraction_state,
        nextRow.extraction_error,
        nextRow.extraction_available_at,
        nextRow.extraction_lease_expires_at,
        existingRow.meta_json
      ),
  })
}

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
  return executeGuardedSavedLinkMetaWrite({
    database,
    userId,
    operationId: input.operationId,
    existingRow,
    nextRow,
    updateStatement: database
      .prepare(
        "UPDATE links SET meta_json = ?3, updated_at = ?4 WHERE id = ?1 AND user_id = ?2 AND meta_json IS ?5"
      )
      .bind(
        existingRow.id,
        userId,
        metadataJson,
        input.now,
        existingRow.meta_json
      ),
  })
}

const executeDeleteSavedLink = async (
  database: D1Database,
  userId: string,
  input: { operationId: string; id: string; now: number }
): Promise<SavedLinkMutationResult> => {
  const existingRow = await requireOwnedSavedLink(database, userId, input.id)
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const deleteOperation = {
    userId,
    operationId: input.operationId,
    linkId: existingRow.id,
  }
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
    condition: createSavedLinkDeleteLedgerCondition(deleteOperation),
  })
  const { dataVersion, changed } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      createSavedLinkDeleteClaimStatement(database, deleteOperation),
      ...ledgerMutation.statements,
      ...createOwnedLinkDeletionStatements(database, [existingRow]),
      createSavedLinkDeleteCompletionStatement(database, deleteOperation),
    ],
    guard: createSavedLinkDeleteGuard(deleteOperation),
  })
  if (!changed) {
    throw new Error(LINK_NOT_FOUND_MESSAGE)
  }
  return { success: true, replayed: false, dataVersion }
}

const executeClearSavedLinks = async (
  database: D1Database,
  userId: string,
  input: ClearSavedLinksInput
): Promise<ClearSavedLinksResult> => {
  let preparation = await ensureStorageLedger(database, userId, input.now)
  let { savedLinkCount } = preparation.ledger
  if (savedLinkCount === 0) {
    const completed = await completeSavedLinkOperationIfNoSavedLinks(database, {
      userId,
      operationId: input.operationId,
    })
    if (completed) {
      return {
        success: true,
        replayed: false,
        deletedLinks: 0,
        dataVersion: await getDataVersion(database, userId),
      }
    }
    // The no-link precondition no longer holds, so refresh the ledger and clear
    // it under the normal owned-write transaction.
    preparation = await ensureStorageLedger(database, userId, input.now)
    ;({ savedLinkCount } = preparation.ledger)
    if (savedLinkCount === 0) {
      await releaseReservedSavedLinkCommandOperation(database, {
        userId,
        operationId: input.operationId,
      })
      return {
        success: false,
        replayed: false,
        deletedLinks: 0,
        dataVersion: await getDataVersion(database, userId),
      }
    }
  }
  const { dataVersion, statementResults } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      database
        .prepare("SELECT COUNT(*) AS count FROM links WHERE user_id = ?1")
        .bind(userId),
      database
        .prepare(
          "DELETE FROM saved_link_extraction_credentials WHERE user_id = ?1"
        )
        .bind(userId),
      database.prepare("DELETE FROM links WHERE user_id = ?1").bind(userId),
      createClearSavedLinksLedgerStatement(database, userId, input.now),
      createSavedLinkOperationCompletionStatement(database, {
        userId,
        operationId: input.operationId,
      }),
    ],
  })
  // SAFETY: the count statement is the first statement after preparation and
  // returns one row with the number of links cleared in this batch.
  const deletedLinksRow = statementResults[preparation.statements.length]
    ?.results?.[0] as { count: number } | undefined
  return {
    success: true,
    replayed: false,
    deletedLinks: deletedLinksRow?.count ?? 0,
    dataVersion,
  }
}

interface SavedLinkOperationReplay {
  operation: CompletedSavedLinkOperation
  dataVersion: number
}

const findSavedLinkOperationReplay = async (
  database: D1Database,
  input: SavedLinkCommandOperationKey
): Promise<SavedLinkOperationReplay | undefined> => {
  const operation = await findCompletedSavedLinkOperation(
    database,
    input.userId,
    input.operationId
  )
  if (!operation) {
    return undefined
  }
  return {
    operation,
    dataVersion: await getDataVersion(database, input.userId),
  }
}

const resolveSavedLinkReservationConflict = async (
  database: D1Database,
  input: SavedLinkCommandOperationKey
): Promise<SavedLinkReservationOutcome> => {
  const replay = await findSavedLinkOperationReplay(database, input)
  if (replay) {
    return {
      kind: "completed",
      operation: replay.operation,
      dataVersion: replay.dataVersion,
    }
  }
  return {
    kind: "inFlight",
    dataVersion: await getDataVersion(database, input.userId),
  }
}

const reserveSavedLinkMutation = async (
  database: D1Database,
  userId: string,
  input: SavedLinkMutationReservationInput
): Promise<SavedLinkMutationResult | undefined> => {
  const replay = await findSavedLinkOperationReplay(database, {
    userId,
    operationId: input.operationId,
  })
  if (replay) {
    return {
      success: true,
      replayed: true,
      dataVersion: replay.dataVersion,
    }
  }
  const reserved = await reserveSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
    command: input.command,
    now: input.now,
  })
  if (!reserved) {
    const outcome = await resolveSavedLinkReservationConflict(database, {
      userId,
      operationId: input.operationId,
    })
    return outcome.kind === "completed"
      ? {
          success: true,
          replayed: true,
          dataVersion: outcome.dataVersion,
        }
      : {
          success: false,
          replayed: false,
          dataVersion: outcome.dataVersion,
        }
  }
  return undefined
}

const reserveCreateOrUpdateSavedLink = async (
  database: D1Database,
  userId: string,
  input: CreateOrUpdateSavedLinkInput
): Promise<SavedLinkCommandResult | undefined> => {
  const replay = await findSavedLinkOperationReplay(database, {
    userId,
    operationId: input.operationId,
  })
  if (replay) {
    return {
      id: replay.operation.linkId,
      replayed: true,
      dataVersion: replay.dataVersion,
    }
  }
  const reserved = await reserveSavedLinkCommandOperation(database, {
    userId,
    operationId: input.operationId,
    command: "create-or-update",
    now: input.now,
  })
  if (!reserved) {
    const outcome = await resolveSavedLinkReservationConflict(database, {
      userId,
      operationId: input.operationId,
    })
    const replayed = outcome.kind === "completed"
    return {
      id: replayed ? outcome.operation.linkId : null,
      replayed,
      dataVersion: outcome.dataVersion,
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
  const { dataVersion, changed } = await executeGuardedSavedLinkMetaWrite({
    database,
    userId,
    operationId: input.operationId,
    existingRow,
    nextRow,
    updateStatement: database
      .prepare(
        "UPDATE links SET title = ?3, meta_json = ?4, updated_at = ?5, expires_at = ?6, extraction_state = ?7, extraction_error = ?8, extraction_attempts = ?9, extraction_available_at = ?10, extraction_lease_expires_at = ?11 WHERE id = ?1 AND user_id = ?2 AND meta_json IS ?12"
      )
      .bind(
        existingRow.id,
        userId,
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
    trailingStatement: extractionCredentialStatement,
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
        ? [...createOwnedLinkDeletionStatements(database, [oldestRow])]
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
}: DeleteExpiredLinksForUserInput): Promise<{
  deletedCount: number
  dataVersion: number
}> => {
  const cutoff = getRetentionCutoff(now, retentionDays)
  const { results } = await database
    .prepare(
      `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE user_id = ?1 AND created_at < ?2 ORDER BY created_at ASC LIMIT ?3`
    )
    .bind(userId, cutoff, LINK_RETENTION_BATCH_SIZE)
    .all<LinkRow>()
  if (results.length === 0) {
    return {
      deletedCount: 0,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const totalBytes = results.reduce<number>(
    (totalRowBytes, row) => totalRowBytes + byteLength(row),
    0
  )
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
  const { dataVersion } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...preparation.statements,
      ...createOwnedLinkDeletionStatements(database, results),
      ...ledgerMutation.statements,
    ],
  })
  return { deletedCount: results.length, dataVersion }
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
  statements.push(...createOwnedLinkDeletionStatements(database, rows))
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
