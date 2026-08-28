import { Effect, Schema } from "effect"
import { parseCanonicalLinkMetadataJson } from "../app/features/links/storage-schemas"
import { decideSavePresentation } from "../app/lib/extraction/presentation"
import { ExtractionService } from "../app/lib/effect/services/extraction-service"
import { getRuntime } from "../app/lib/effect/runtime"
import {
  LINK_EXTRACTION_BATCH_SIZE,
  LINK_EXTRACTION_MAX_ATTEMPTS,
  EMPTY_LINK_METADATA_JSON,
} from "./constants"
import {
  claimNextSavedLinkExtraction,
  getSavedLinkQueueError,
  requeuePendingSavedLinkExtraction,
  settleSavedLinkExtraction,
} from "./d1/link-extraction-queue"
import { notifyAccountDataChanged } from "./d1/data-version-notification"

const savedExtractionIdentitySchema = Schema.Struct({
  pluginServerId: Schema.optional(Schema.String),
  pluginId: Schema.optional(Schema.String),
})

const getSavedExtractionIdentity = (metaJson: string | null) => {
  const metadata = parseCanonicalLinkMetadataJson(
    metaJson ?? EMPTY_LINK_METADATA_JSON
  )
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
  const runtime = getRuntime(env)

  try {
    const extraction = await runtime.runPromise(
      Effect.flatMap(ExtractionService, (service) =>
        service.extract({
          url: claim.url,
          requestId,
          userId: claim.userId,
          pluginServerId: identity.pluginServerId,
          pluginId: identity.pluginId,
        })
      )
    )
    if (
      extraction.pending &&
      claim.extractionAttempts < LINK_EXTRACTION_MAX_ATTEMPTS
    ) {
      const requeued = await requeuePendingSavedLinkExtraction(
        database,
        claim.userId,
        {
          operationId: `link-extraction:pending:${claim.id}:${claim.extractionAttempts}`,
          id: claim.id,
          leaseExpiresAt: claim.leaseExpiresAt,
          retryAfterSeconds: extraction.pending.retryAfterSeconds,
          now: Date.now(),
        }
      )
      await notifySafely(env, claim.userId, requeued.dataVersion)
      return true
    }
    const presentation = decideSavePresentation([...extraction.links])
    if (presentation.kind === "error") {
      const settled = await settleSavedLinkExtraction(database, claim.userId, {
        operationId: `link-extraction:settle:${claim.id}:${claim.extractionAttempts}:failed`,
        id: claim.id,
        leaseExpiresAt: claim.leaseExpiresAt,
        state: "failed",
        error: "No playable links found. Try a different link.",
        now: Date.now(),
      })
      await notifySafely(env, claim.userId, settled.dataVersion)
      return true
    }
    const settled = await settleSavedLinkExtraction(database, claim.userId, {
      operationId: `link-extraction:settle:${claim.id}:${claim.extractionAttempts}:complete`,
      id: claim.id,
      leaseExpiresAt: claim.leaseExpiresAt,
      state: "complete",
      meta: extraction.meta,
      extractedLinks: [...extraction.links],
      now: Date.now(),
    })
    await notifySafely(env, claim.userId, settled.dataVersion)
  } catch (error) {
    const extractionError =
      error instanceof Error ? error : new Error("Unable to load links.")
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
      now: Date.now(),
    })
    await notifySafely(env, claim.userId, settled.dataVersion)
  }
  return true
}

export const processQueuedLinkExtractions = async (
  env: Env,
  database: D1Database
): Promise<void> => {
  for (
    let extractionIndex = 0;
    extractionIndex < LINK_EXTRACTION_BATCH_SIZE;
    extractionIndex += 1
  ) {
    const didProcessExtraction = await processSavedLinkExtraction(env, database)
    if (!didProcessExtraction) {
      break
    }
  }
}
