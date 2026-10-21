import type { HttpBasicAuth } from "@dg02002/lynvo-plugin-server-protocol"
import { Effect, Schema } from "effect"

import { parseCanonicalLinkMetadataJson } from "~/features/links/storage-schemas"

import { ExtractionError } from "../app/lib/effect/errors"
import { getRuntime } from "../app/lib/effect/runtime"
import { ExtractionService } from "../app/lib/effect/services/extraction-service"
import type {
  ExtractionPending,
  ExtractionResult,
} from "../app/lib/effect/services/extraction-types"
import { decideSavePresentation } from "../app/lib/extraction/presentation"
import {
  LINK_EXTRACTION_BATCH_SIZE,
  LINK_EXTRACTION_MAX_ATTEMPTS,
  LINK_EXTRACTION_TRANSIENT_RETRY_SECONDS,
} from "./constants"
import {
  claimNextSavedLinkExtraction,
  getSavedLinkQueueError,
  requeuePendingSavedLinkExtraction,
  settleSavedLinkExtraction,
  type SavedLinkExtractionClaim,
} from "./d1/link-extraction-queue"
import {
  decryptSavedLinkExtractionCredential,
  getSavedLinkExtractionCredential,
} from "./d1/saved-link-extraction-credentials"

const savedExtractionIdentitySchema = Schema.Struct({
  pluginServerId: Schema.optional(Schema.String),
  pluginId: Schema.optional(Schema.String),
})

interface SavedExtractionIdentity {
  pluginServerId?: string
  pluginId?: string
}

interface SavedLinkExtractionExecutionContext {
  env: Env
  database: D1Database
  claim: SavedLinkExtractionClaim
  identity: SavedExtractionIdentity
  runtime: ReturnType<typeof getRuntime>
  requestId: string
  startedAt: number
  inlineBasicAuth?: HttpBasicAuth
}

interface PendingExtractionInput extends SavedLinkExtractionExecutionContext {
  pending: ExtractionPending
  extraction: ExtractionResult
}

interface CompletedExtractionInput extends SavedLinkExtractionExecutionContext {
  extraction: ExtractionResult
}

interface FailedExtractionInput extends SavedLinkExtractionExecutionContext {
  extractionError: ExtractionError
}

const getSavedExtractionIdentity = (
  metaJson: string
): SavedExtractionIdentity => {
  const metadata = parseCanonicalLinkMetadataJson(metaJson)
  return Schema.decodeUnknownSync(savedExtractionIdentitySchema)(
    metadata.source
  )
}

const runSavedLinkExtraction = async ({
  runtime,
  claim,
  identity,
  requestId,
  inlineBasicAuth,
}: SavedLinkExtractionExecutionContext): Promise<ExtractionResult> =>
  runtime.runPromise(
    Effect.flatMap(ExtractionService, (service) =>
      service.extract({
        url: claim.url,
        requestId,
        userId: claim.userId,
        pluginServerId: identity.pluginServerId,
        pluginId: identity.pluginId,
        inlineBasicAuth,
      })
    )
  )

const settlePendingExtraction = async ({
  env,
  database,
  claim,
  pending,
  extraction,
  requestId,
  startedAt,
}: PendingExtractionInput): Promise<void> => {
  await requeuePendingSavedLinkExtraction(database, claim.userId, {
    operationId: `link-extraction:pending:${claim.id}:${claim.extractionAttempts}`,
    id: claim.id,
    leaseExpiresAt: claim.leaseExpiresAt,
    retryAfterSeconds: pending.retryAfterSeconds,
    now: Date.now(),
    realtime: env.USER_REALTIME_ROOM,
    debugLogEntry: {
      at: Date.now(),
      pluginServerId: extraction.meta?.pluginServerId,
      pluginId: extraction.meta?.pluginId,
      outcome: "pending",
      requestId,
      attempt: claim.extractionAttempts,
      durationMs: Date.now() - startedAt,
      detail: `Server deferred extraction; retrying in ${pending.retryAfterSeconds}s`,
    },
  })
}

const settleEmptyExtraction = async ({
  env,
  database,
  claim,
  extraction,
  requestId,
  startedAt,
}: CompletedExtractionInput): Promise<void> => {
  await settleSavedLinkExtraction(database, claim.userId, {
    operationId: `link-extraction:settle:${claim.id}:${claim.extractionAttempts}:failed`,
    id: claim.id,
    leaseExpiresAt: claim.leaseExpiresAt,
    state: "failed",
    error: "No playable links found. Try a different link.",
    debugLogEntry: {
      at: Date.now(),
      pluginServerId: extraction.meta?.pluginServerId,
      pluginId: extraction.meta?.pluginId,
      outcome: "failed",
      requestId,
      errorCode: "EMPTY_RESULT",
      nodeCount: extraction.links.length,
      attempt: claim.extractionAttempts,
      durationMs: Date.now() - startedAt,
      detail: "Extraction succeeded but produced no playable links",
    },
    now: Date.now(),
    realtime: env.USER_REALTIME_ROOM,
  })
}

const settleCompletedExtraction = async ({
  env,
  database,
  claim,
  extraction,
  requestId,
  startedAt,
}: CompletedExtractionInput): Promise<void> => {
  await settleSavedLinkExtraction(database, claim.userId, {
    operationId: `link-extraction:settle:${claim.id}:${claim.extractionAttempts}:complete`,
    id: claim.id,
    leaseExpiresAt: claim.leaseExpiresAt,
    state: "complete",
    meta: extraction.meta,
    extractedLinks: [...extraction.links],
    debugLogEntry: {
      at: Date.now(),
      pluginServerId: extraction.meta?.pluginServerId,
      pluginId: extraction.meta?.pluginId,
      outcome: "complete",
      requestId,
      nodeCount: extraction.links.length,
      attempt: claim.extractionAttempts,
      durationMs: Date.now() - startedAt,
    },
    now: Date.now(),
    realtime: env.USER_REALTIME_ROOM,
  })
}

const settleFailedExtraction = async ({
  env,
  database,
  claim,
  identity,
  requestId,
  startedAt,
  extractionError,
}: FailedExtractionInput): Promise<void> => {
  console.error("Saved link extraction failed", {
    error: extractionError,
    linkId: claim.id,
    userId: claim.userId,
  })
  await settleSavedLinkExtraction(database, claim.userId, {
    operationId: `link-extraction:settle:${claim.id}:${claim.extractionAttempts}:failed`,
    id: claim.id,
    leaseExpiresAt: claim.leaseExpiresAt,
    state: "failed",
    error: getSavedLinkQueueError(extractionError),
    debugLogEntry: {
      at: Date.now(),
      pluginServerId: identity.pluginServerId,
      pluginId: identity.pluginId,
      outcome: "failed",
      requestId,
      errorCode: extractionError.message.split(".")[0],
      attempt: claim.extractionAttempts,
      durationMs: Date.now() - startedAt,
      detail:
        extractionError.detail ??
        `Plugin Server rejected the request with ${extractionError.message}`,
      httpStatus: extractionError.status,
    },
    now: Date.now(),
    realtime: env.USER_REALTIME_ROOM,
  })
}

const isRetryableExtractionError = (error: ExtractionError): boolean =>
  error.message === "TEMPORARY_FAILURE" ||
  error.status === 408 ||
  (error.status !== undefined && error.status >= 500 && error.status <= 599)

const requeueRetryableExtraction = async ({
  env,
  database,
  claim,
  identity,
  requestId,
  startedAt,
  extractionError,
}: FailedExtractionInput): Promise<void> => {
  const now = Date.now()
  await requeuePendingSavedLinkExtraction(database, claim.userId, {
    operationId: `link-extraction:pending:${claim.id}:${claim.extractionAttempts}`,
    id: claim.id,
    leaseExpiresAt: claim.leaseExpiresAt,
    retryAfterSeconds: LINK_EXTRACTION_TRANSIENT_RETRY_SECONDS,
    debugLogEntry: {
      at: now,
      pluginServerId: identity.pluginServerId,
      pluginId: identity.pluginId,
      outcome: "requeued",
      requestId,
      errorCode: extractionError.message,
      attempt: claim.extractionAttempts,
      durationMs: now - startedAt,
      detail: `Temporary extraction failure; retrying in ${LINK_EXTRACTION_TRANSIENT_RETRY_SECONDS}s`,
      httpStatus: extractionError.status,
    },
    now,
    realtime: env.USER_REALTIME_ROOM,
  })
}

const processClaimedSavedLinkExtraction = async (
  context: SavedLinkExtractionExecutionContext
): Promise<void> => {
  const extraction = await runSavedLinkExtraction(context)
  if (
    extraction.pending &&
    context.claim.extractionAttempts < LINK_EXTRACTION_MAX_ATTEMPTS
  ) {
    await settlePendingExtraction({
      ...context,
      pending: extraction.pending,
      extraction,
    })
    return
  }
  const presentation = decideSavePresentation([...extraction.links])
  if (presentation.kind === "error") {
    await settleEmptyExtraction({ ...context, extraction })
    return
  }
  await settleCompletedExtraction({ ...context, extraction })
}

export const processSavedLinkExtraction = async (
  env: Env,
  database: D1Database,
  linkId?: string
): Promise<boolean> => {
  const claim = await claimNextSavedLinkExtraction(database, {
    now: Date.now(),
    linkId,
    realtime: env.USER_REALTIME_ROOM,
  })
  if (!claim) {
    return false
  }

  const requestId = `background-link-extraction:${claim.id}:${claim.extractionAttempts}`
  const identity = getSavedExtractionIdentity(claim.metaJson)
  const context: SavedLinkExtractionExecutionContext = {
    env,
    database,
    claim,
    identity,
    runtime: getRuntime(env),
    requestId,
    startedAt: Date.now(),
  }

  try {
    const credentialRow = await getSavedLinkExtractionCredential(
      database,
      claim.userId,
      claim.id
    )
    if (credentialRow) {
      if (credentialRow.target_url !== claim.url) {
        throw new Error("Saved link credential target changed.")
      }
      context.inlineBasicAuth = await decryptSavedLinkExtractionCredential(
        env,
        credentialRow,
        { userId: claim.userId, targetUrl: claim.url }
      )
    }
    await processClaimedSavedLinkExtraction(context)
  } catch (error) {
    const extractionError =
      error instanceof ExtractionError
        ? error
        : new ExtractionError({
            message:
              error instanceof Error ? error.message : "Unable to load links.",
            url: claim.url,
          })
    if (
      isRetryableExtractionError(extractionError) &&
      claim.extractionAttempts < LINK_EXTRACTION_MAX_ATTEMPTS
    ) {
      await requeueRetryableExtraction({ ...context, extractionError })
    } else {
      await settleFailedExtraction({ ...context, extractionError })
    }
  }
  return true
}

interface QueuedLinkExtractionDrainState {
  env: Env
  database: D1Database
  extractionsRemaining: number
}

const processNextQueuedLinkExtraction = async ({
  env,
  database,
  extractionsRemaining,
}: QueuedLinkExtractionDrainState): Promise<void> => {
  if (extractionsRemaining === 0) {
    return
  }
  const didProcessExtraction = await processSavedLinkExtraction(env, database)
  if (!didProcessExtraction) {
    return
  }
  await processNextQueuedLinkExtraction({
    env,
    database,
    extractionsRemaining: extractionsRemaining - 1,
  })
}

export const processQueuedLinkExtractions = async (
  env: Env,
  database: D1Database
): Promise<void> =>
  processNextQueuedLinkExtraction({
    env,
    database,
    extractionsRemaining: LINK_EXTRACTION_BATCH_SIZE,
  })
