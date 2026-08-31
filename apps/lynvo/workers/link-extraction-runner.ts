import { Effect, Schema } from "effect"
import type { HttpBasicAuth } from "@dg02002/lynvo-plugin-server-protocol"
import { parseCanonicalLinkMetadataJson } from "../app/features/links/storage-schemas"
import { decideSavePresentation } from "../app/lib/extraction/presentation"
import { ExtractionService } from "../app/lib/effect/services/extraction-service"
import { ExtractionError } from "../app/lib/effect/errors"
import { getRuntime } from "../app/lib/effect/runtime"
import type {
  ExtractionPending,
  ExtractionResult,
} from "../app/lib/effect/services/extraction-types"
import {
  LINK_EXTRACTION_BATCH_SIZE,
  LINK_EXTRACTION_MAX_ATTEMPTS,
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
import { notifyAccountDataChanged } from "./d1/data-version-notification"

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

const notifySafely = async (
  env: Env,
  userId: string,
  dataVersion: number
): Promise<void> => {
  try {
    await notifyAccountDataChanged(env, userId, dataVersion)
  } catch (error) {
    console.error("Unable to notify saved link extraction change", error)
  }
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
  startedAt,
}: PendingExtractionInput): Promise<void> => {
  const requeued = await requeuePendingSavedLinkExtraction(
    database,
    claim.userId,
    {
      operationId: `link-extraction:pending:${claim.id}:${claim.extractionAttempts}`,
      id: claim.id,
      leaseExpiresAt: claim.leaseExpiresAt,
      retryAfterSeconds: pending.retryAfterSeconds,
      now: Date.now(),
      debugLogEntry: {
        at: Date.now(),
        pluginServerId: extraction.meta?.pluginServerId,
        pluginId: extraction.meta?.pluginId,
        outcome: "pending",
        attempt: claim.extractionAttempts,
        durationMs: Date.now() - startedAt,
        detail: `Server deferred extraction; retrying in ${pending.retryAfterSeconds}s`,
      },
    }
  )
  await notifySafely(env, claim.userId, requeued.dataVersion)
}

const settleEmptyExtraction = async ({
  env,
  database,
  claim,
  extraction,
  startedAt,
}: CompletedExtractionInput): Promise<void> => {
  const settled = await settleSavedLinkExtraction(database, claim.userId, {
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
      errorCode: "EMPTY_RESULT",
      nodeCount: extraction.links.length,
      attempt: claim.extractionAttempts,
      durationMs: Date.now() - startedAt,
      detail: "Extraction succeeded but produced no playable links",
    },
    now: Date.now(),
  })
  await notifySafely(env, claim.userId, settled.dataVersion)
}

const settleCompletedExtraction = async ({
  env,
  database,
  claim,
  extraction,
  startedAt,
}: CompletedExtractionInput): Promise<void> => {
  const settled = await settleSavedLinkExtraction(database, claim.userId, {
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
      nodeCount: extraction.links.length,
      attempt: claim.extractionAttempts,
      durationMs: Date.now() - startedAt,
    },
    now: Date.now(),
  })
  await notifySafely(env, claim.userId, settled.dataVersion)
}

const settleFailedExtraction = async ({
  env,
  database,
  claim,
  identity,
  startedAt,
  extractionError,
}: FailedExtractionInput): Promise<void> => {
  console.error("Saved link extraction failed", {
    error: extractionError,
    linkId: claim.id,
    userId: claim.userId,
  })
  const settled = await settleSavedLinkExtraction(database, claim.userId, {
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
      errorCode: extractionError.message.split(".")[0],
      attempt: claim.extractionAttempts,
      durationMs: Date.now() - startedAt,
      detail:
        extractionError.detail ??
        `Plugin Server rejected the request with ${extractionError.message}`,
      httpStatus: extractionError.status,
    },
    now: Date.now(),
  })
  await notifySafely(env, claim.userId, settled.dataVersion)
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
  })
  if (!claim) {
    return false
  }
  await notifySafely(env, claim.userId, claim.dataVersion)

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
    await settleFailedExtraction({ ...context, extractionError })
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
