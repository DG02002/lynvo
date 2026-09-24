import { Result, Schema } from "effect"
import { Hono, type Context as HonoContext } from "hono"

import { extractHttpBasicCredential } from "../../app/lib/plugins/http-basic-credential"
import { MediaArtworkRequestSchema } from "../../shared/api-contracts"
import {
  DOCS_SEED_ARTWORK_POLICY,
  DOCS_SEED_MANAGED_USAGE_OPERATION_ID_PREFIX,
} from "../../shared/docs-seed-constants"
import {
  DEFAULT_RETENTION_DAYS,
  LINK_LIMIT_BYTES,
  MAX_RETENTION_DAYS,
  STORAGE_RETENTION_DAY_OPTIONS,
  USER_STORAGE_LIMIT_BYTES,
  USER_STORAGE_WARNING_BYTES,
  DATA_VERSION_RESPONSE_HEADER,
  MEDIA_ARTWORK_REQUEST_BATCH_LIMIT,
} from "../constants"
import { processSavedLinkExtraction } from "../link-extraction-runner"
import { lookupMediaArtworkCached } from "../media-metadata/artwork-cache"
import {
  addRequestContext,
  type RequestLoggingEnvironment,
} from "../request-logging"
import { isSameOriginRequest } from "../same-origin"
import { notifyAccountDataChanged } from "./data-version-notification"
import { getD1Database } from "./db"
import { resetDocsSeedManagedUsage } from "./docs-seed-usage"
import {
  LinkNotFoundError,
  LinkTooLargeError,
  StorageLimitError,
} from "./errors"
import { enqueueSavedLinkExtraction } from "./link-extraction-queue"
import {
  applySavedLinkMetadataOperation,
  clearSavedLinks,
  countExpiredLinksForUser,
  createOrUpdateSavedLink,
  deleteExpiredLinksForUser,
  deleteSavedLinkById,
  getUserRetentionDays,
  listSavedLinksWithDataVersion,
  updateSavedLinkMeta,
} from "./links"
import {
  encryptSavedLinkExtractionCredential,
  type SavedLinkExtractionCredentialWrite,
} from "./saved-link-extraction-credentials"
import {
  isDevelopmentAuthBypassEnabled,
  resolveD1Session,
  type SessionRecord,
} from "./sessions"
import {
  calculateAppOwnedStorageUsage,
  getStorageLedger,
} from "./storage-ledger"
import {
  getUsage,
  reserveManagedExtraction,
  settleManagedExtraction,
} from "./usage"
import { normalizeRetentionDays, updateUserStorageRetentionDays } from "./users"

type DataRouteContext = HonoContext<RequestLoggingEnvironment>

type DataFailureStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503

const safeWaitUntil = (
  context: DataRouteContext,
  promise: Promise<unknown>
): void => {
  try {
    if (context.executionCtx?.waitUntil) {
      context.executionCtx.waitUntil(promise)
    }
  } catch {
    // ExecutionContext not available in testing environment; ignore background work
  }
}

const EXTRACTION_CONFLICT_MESSAGE =
  "Saved link extraction changed; refresh and retry"
const RETENTION_INVALID_MESSAGE = "Choose an available auto-delete period"

interface RespondDataFailureInput {
  readonly context: DataRouteContext
  readonly status: DataFailureStatus
  readonly kind: string
  readonly message: string
}

const respondDataFailure = async ({
  context,
  status,
  kind,
  message,
}: RespondDataFailureInput): Promise<Response> =>
  context.json({ failure: { kind, message } }, status)

const dataApp = new Hono<RequestLoggingEnvironment>()

dataApp.onError(async (error, context) => {
  if (error instanceof StorageLimitError) {
    return context.json(
      {
        failure: {
          kind: "storage-limit",
          usedBytes: error.usedBytes,
          limitBytes: error.limitBytes,
        },
      },
      422
    )
  }
  if (error instanceof LinkTooLargeError) {
    return context.json(
      {
        failure: {
          kind: "link-too-large",
          sizeBytes: error.sizeBytes,
          limitBytes: error.limitBytes,
        },
      },
      422
    )
  }
  if (error instanceof LinkNotFoundError) {
    return await respondDataFailure({
      context,
      status: 404,
      kind: "validation",
      message: error.message,
    })
  }
  const message = error instanceof Error ? error.message : String(error)
  if (message === EXTRACTION_CONFLICT_MESSAGE) {
    return await respondDataFailure({
      context,
      status: 409,
      kind: "validation",
      message,
    })
  }
  if (message === RETENTION_INVALID_MESSAGE) {
    return await respondDataFailure({
      context,
      status: 400,
      kind: "validation",
      message,
    })
  }
  addRequestContext(context, {
    error: {
      type: error instanceof Error ? error.name : "UnknownError",
      message,
    },
  })
  return await respondDataFailure({
    context,
    status: 500,
    kind: "temporarily-unavailable",
    message: context.get("requestId"),
  })
})

interface DataRequestReady {
  readonly kind: "ready"
  readonly database: D1Database
  readonly session: SessionRecord
}

interface DataRequestTerminated {
  readonly kind: "terminated"
  readonly response: Response
}

type DataRequestPreparation = DataRequestReady | DataRequestTerminated

const isReadyDataRequest = (
  preparation: DataRequestPreparation
): preparation is DataRequestReady => preparation.kind === "ready"

const beginDataRequest = async (
  context: DataRouteContext,
  options: { mutating: boolean }
): Promise<DataRequestPreparation> => {
  const database = getD1Database(context.env)
  if (!database) {
    return {
      kind: "terminated",
      response: await respondDataFailure({
        context,
        status: 503,
        kind: "service-unavailable",
        message: "Data storage is temporarily unavailable",
      }),
    }
  }
  if (options.mutating && !isSameOriginRequest(context.req.raw)) {
    return {
      kind: "terminated",
      response: await respondDataFailure({
        context,
        status: 403,
        kind: "csrf-expired",
        message: "Mutation forbidden",
      }),
    }
  }
  const session = await resolveD1Session(context.req.raw, database, context.env)
  if (!session) {
    return {
      kind: "terminated",
      response: await respondDataFailure({
        context,
        status: 401,
        kind: "session-expired",
        message: "Session expired",
      }),
    }
  }
  addRequestContext(context, { user_id: session.userId })
  return { kind: "ready", database, session }
}

const respondInvalidBody = async (
  context: DataRouteContext
): Promise<Response> =>
  respondDataFailure({
    context,
    status: 400,
    kind: "validation",
    message: "Send a valid request.",
  })

interface DataRequestBody<Body> {
  readonly kind: "body"
  readonly body: Body
}

interface DataRequestInvalid {
  readonly kind: "invalid"
  readonly response: Response
}

type DataRequestBodyResult<Body> = DataRequestBody<Body> | DataRequestInvalid

const readDataJsonBody = async <S extends Schema.ConstraintDecoder<unknown>>(
  context: DataRouteContext,
  schema: S
): Promise<DataRequestBodyResult<S["Type"]>> => {
  let payload: unknown
  try {
    payload = await context.req.json()
  } catch {
    return { kind: "invalid", response: await respondInvalidBody(context) }
  }
  const parsed = Schema.decodeUnknownResult(schema)(payload)
  return Result.isSuccess(parsed)
    ? { kind: "body", body: parsed.success }
    : { kind: "invalid", response: await respondInvalidBody(context) }
}

const createOrUpdateSchema = Schema.Struct({
  operationId: Schema.NonEmptyString,
  url: Schema.NonEmptyString,
  title: Schema.optional(Schema.String),
  meta: Schema.NonEmptyString,
  extractionState: Schema.optional(Schema.Literal("queued")),
  seedFixture: Schema.optional(
    Schema.Struct({
      createdAt: Schema.optional(Schema.Number),
      extractionFailure: Schema.optional(Schema.NonEmptyString),
    })
  ),
})

interface CreateOrUpdateLinkOptions {
  readonly context: DataRouteContext
  readonly preparation: DataRequestReady
  readonly body: Schema.Schema.Type<typeof createOrUpdateSchema>
}

const createOrUpdateLink = async ({
  context,
  preparation,
  body,
}: CreateOrUpdateLinkOptions): Promise<Response> => {
  const now = Date.now()
  if (
    body.seedFixture &&
    (!isDevelopmentAuthBypassEnabled(context.env) ||
      (body.seedFixture.createdAt !== undefined &&
        (!Number.isFinite(body.seedFixture.createdAt) ||
          body.seedFixture.createdAt > now)) ||
      (body.seedFixture.extractionFailure !== undefined &&
        body.extractionState === "queued"))
  ) {
    return await respondInvalidBody(context)
  }
  let sourceInput: ReturnType<typeof extractHttpBasicCredential>
  try {
    sourceInput = extractHttpBasicCredential(body.url)
  } catch {
    return await respondDataFailure({
      context,
      status: 400,
      kind: "validation",
      message: "Enter a valid URL.",
    })
  }
  let extractionCredential: SavedLinkExtractionCredentialWrite | null = null
  if (body.extractionState === "queued" && sourceInput.basicAuth) {
    extractionCredential = {
      targetUrl: sourceInput.url,
      record: await encryptSavedLinkExtractionCredential(context.env, {
        userId: preparation.session.userId,
        targetUrl: sourceInput.url,
        basicAuth: sourceInput.basicAuth,
      }),
      now,
    }
  }
  const { seedFixture, ...linkBody } = body
  const extractionState: "queued" | "failed" | undefined =
    seedFixture?.extractionFailure === undefined
      ? body.extractionState
      : "failed"
  const normalizedInput = {
    ...linkBody,
    url: sourceInput.url,
    now,
    createdAt: seedFixture?.createdAt,
    extractionState,
    extractionError: seedFixture?.extractionFailure,
  }
  const result =
    body.extractionState === "queued"
      ? await enqueueSavedLinkExtraction(
          preparation.database,
          preparation.session.userId,
          { ...normalizedInput, extractionCredential }
        )
      : await createOrUpdateSavedLink(
          preparation.database,
          preparation.session.userId,
          normalizedInput
        )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    result.dataVersion
  )
  if (result.id && body.extractionState === "queued") {
    safeWaitUntil(
      context,
      processSavedLinkExtraction(context.env, preparation.database, result.id)
    )
  }
  return context.json(result)
}

const updateMetaSchema = Schema.Struct({
  operationId: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  meta: Schema.NonEmptyString,
})

const deleteLinkSchema = Schema.Struct({
  operationId: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
})

const clearLinksSchema = Schema.Struct({
  operationId: Schema.NonEmptyString,
})

const metadataOperationSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("markOpened"),
    linkUrl: Schema.NonEmptyString,
  }),
  Schema.Struct({
    kind: Schema.Literal("cacheMirrors"),
    lazyItemUrl: Schema.NonEmptyString,
    mirrorsJson: Schema.NonEmptyString,
  }),
  Schema.Struct({
    kind: Schema.Literal("removeExtractedLink"),
    linkKey: Schema.NonEmptyString,
    linkUrl: Schema.NonEmptyString,
  }),
  Schema.Struct({
    kind: Schema.Literal("replaceExtraction"),
    expectedExtractionJson: Schema.String,
    extractedLinksJson: Schema.String,
    debugLogEntryJson: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal("appendDebugLog"),
    debugLogEntryJson: Schema.NonEmptyString,
  }),
  Schema.Struct({
    kind: Schema.Literal("setArtwork"),
    providerId: Schema.Number,
    title: Schema.NonEmptyString,
    year: Schema.optional(Schema.Number),
    mediaKind: Schema.optional(Schema.Literals(["movie", "tv"])),
  }),
])

const applyMetadataOperationSchema = Schema.Struct({
  operationId: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  operation: metadataOperationSchema,
})

const retentionDaysSchema = Schema.Struct({
  days: Schema.Int,
  deleteExpiredLinks: Schema.optional(Schema.Boolean),
})

const mediaArtworkRequestSchema = Schema.Struct({
  requests: Schema.Array(MediaArtworkRequestSchema),
})

dataApp.get("/links", async (context) => {
  addRequestContext(context, { operation: "data_links_list" })
  const preparation = await beginDataRequest(context, { mutating: false })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const snapshot = await listSavedLinksWithDataVersion(
    preparation.database,
    preparation.session.userId,
    Date.now()
  )
  const response = context.json({ links: snapshot.results })
  response.headers.set(
    DATA_VERSION_RESPONSE_HEADER,
    String(snapshot.dataVersion)
  )
  return response
})

dataApp.post("/media-artwork", async (context) => {
  addRequestContext(context, { operation: "data_media_artwork_lookup" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const body = await readDataJsonBody(context, mediaArtworkRequestSchema)
  if (body.kind === "invalid") {
    return body.response
  }
  if (body.body.requests.length > MEDIA_ARTWORK_REQUEST_BATCH_LIMIT) {
    return await respondDataFailure({
      context,
      status: 400,
      kind: "validation",
      message: "Too many artwork requests",
    })
  }
  if (
    isDevelopmentAuthBypassEnabled(context.env) &&
    (await preparation.database
      .prepare(
        "SELECT 1 AS found FROM links WHERE user_id = ?1 AND json_extract(meta_json, '$.artworkPolicy') = ?2 LIMIT 1"
      )
      .bind(preparation.session.userId, DOCS_SEED_ARTWORK_POLICY)
      .first<{ found: number }>())
  ) {
    return context.json({ results: body.body.requests.map(() => ({})) })
  }
  const results = await lookupMediaArtworkCached(
    context.env,
    body.body.requests,
    {
      waitUntil: (promise) => safeWaitUntil(context, promise),
    }
  )
  return context.json({ results })
})

dataApp.post("/links/create-or-update", async (context) => {
  addRequestContext(context, { operation: "data_links_create_or_update" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(context, createOrUpdateSchema)
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  return createOrUpdateLink({
    context,
    preparation,
    body: requestBody.body,
  })
})

dataApp.post("/links/update-meta", async (context) => {
  addRequestContext(context, { operation: "data_links_update_meta" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(context, updateMetaSchema)
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const { body } = requestBody
  const result = await updateSavedLinkMeta(
    preparation.database,
    preparation.session.userId,
    { ...body, now: Date.now() }
  )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    result.dataVersion
  )
  return context.json(result)
})

dataApp.post("/links/apply-metadata-operation", async (context) => {
  addRequestContext(context, {
    operation: "data_links_apply_metadata_operation",
  })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(
    context,
    applyMetadataOperationSchema
  )
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const { body } = requestBody
  const result = await applySavedLinkMetadataOperation(
    preparation.database,
    preparation.session.userId,
    { ...body, now: Date.now() }
  )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    result.dataVersion
  )
  return context.json(result)
})

dataApp.post("/links/delete", async (context) => {
  addRequestContext(context, { operation: "data_links_delete" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(context, deleteLinkSchema)
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const { body } = requestBody
  const result = await deleteSavedLinkById(
    preparation.database,
    preparation.session.userId,
    { operationId: body.operationId, id: body.id, now: Date.now() }
  )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    result.dataVersion
  )
  return context.json(result)
})

dataApp.post("/links/clear", async (context) => {
  addRequestContext(context, { operation: "data_links_clear" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(context, clearLinksSchema)
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const result = await clearSavedLinks(
    preparation.database,
    preparation.session.userId,
    { operationId: requestBody.body.operationId, now: Date.now() }
  )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    result.dataVersion
  )
  return context.json(result)
})

dataApp.get("/storage-settings", async (context) => {
  addRequestContext(context, { operation: "data_storage_settings_read" })
  const preparation = await beginDataRequest(context, { mutating: false })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const { database, session } = preparation
  const [ledger, retentionDays] = await Promise.all([
    getStorageLedger(database, session.userId).then(
      (existingLedger) =>
        existingLedger ??
        calculateAppOwnedStorageUsage(database, session.userId)
    ),
    getUserRetentionDays(database, session.userId),
  ])
  return context.json({
    enforcedBytes: ledger.totalEnforcedBytes,
    linkBytes: ledger.linkBytes,
    pluginServerBytes: ledger.pluginServerBytes,
    pluginDomainBytes: ledger.pluginDomainBytes + ledger.pluginCredentialBytes,
    profileBytes: ledger.profileBytes,
    savedLinkCount: ledger.savedLinkCount,
    averageLinkBytes:
      ledger.savedLinkCount > 0
        ? Math.round(ledger.linkBytes / ledger.savedLinkCount)
        : 0,
    storageLimitBytes: USER_STORAGE_LIMIT_BYTES,
    storageWarningBytes: USER_STORAGE_WARNING_BYTES,
    linkLimitBytes: LINK_LIMIT_BYTES,
    retentionDays: retentionDays || DEFAULT_RETENTION_DAYS,
    retentionDayOptions: [...STORAGE_RETENTION_DAY_OPTIONS],
    defaultRetentionDays: DEFAULT_RETENTION_DAYS,
    maxRetentionDays: MAX_RETENTION_DAYS,
  })
})

dataApp.get("/storage-settings/retention-preview", async (context) => {
  addRequestContext(context, { operation: "data_storage_retention_preview" })
  const preparation = await beginDataRequest(context, { mutating: false })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const days = normalizeRetentionDays(Number(context.req.query("days")))
  const expiredLinkCount = await countExpiredLinksForUser({
    database: preparation.database,
    userId: preparation.session.userId,
    retentionDays: days,
    now: Date.now(),
  })
  return context.json({ expiredLinkCount })
})

dataApp.patch("/storage-settings", async (context) => {
  addRequestContext(context, { operation: "data_storage_settings_update" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(context, retentionDaysSchema)
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const { body } = requestBody
  const result = await updateUserStorageRetentionDays(
    preparation.database,
    preparation.session.userId,
    { days: body.days, now: Date.now() }
  )
  // The deletion is the last owned write; its version is the response's
  // version, not the retention update's.
  const deletion = body.deleteExpiredLinks
    ? await deleteExpiredLinksForUser({
        database: preparation.database,
        userId: preparation.session.userId,
        retentionDays: body.days,
        now: Date.now(),
      })
    : { deletedCount: 0, dataVersion: result.dataVersion }
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    deletion.dataVersion
  )
  return context.json({
    success: true,
    deletedLinks: deletion.deletedCount,
    dataVersion: deletion.dataVersion,
  })
})

dataApp.get("/usage", async (context) => {
  addRequestContext(context, { operation: "data_usage_read" })
  const preparation = await beginDataRequest(context, { mutating: false })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const usage = await getUsage(
    preparation.database,
    preparation.session.userId,
    Date.now()
  )
  return context.json(usage)
})

dataApp.post("/usage/docs-seed", async (context) => {
  addRequestContext(context, { operation: "data_docs_seed_usage" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  if (!isDevelopmentAuthBypassEnabled(context.env)) {
    return await respondDataFailure({
      context,
      status: 404,
      kind: "not_found",
      message: "Usage fixture is available only in no-auth development mode.",
    })
  }
  const requestBody = await readDataJsonBody(
    context,
    Schema.Struct({ operationId: Schema.NonEmptyString })
  )
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  if (
    !requestBody.body.operationId.startsWith(
      DOCS_SEED_MANAGED_USAGE_OPERATION_ID_PREFIX
    )
  ) {
    return await respondInvalidBody(context)
  }

  await resetDocsSeedManagedUsage(
    preparation.database,
    preparation.session.userId,
    requestBody.body.operationId
  )
  await reserveManagedExtraction(
    preparation.database,
    preparation.session.userId,
    {
      operationId: requestBody.body.operationId,
      pluginId: "direct-media",
      now: Date.now(),
    }
  )
  const settlement = await settleManagedExtraction(
    preparation.database,
    preparation.session.userId,
    {
      operationId: requestBody.body.operationId,
      outcome: "consumed",
      now: Date.now(),
    }
  )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    settlement.dataVersion
  )
  const response = context.json({
    success: true,
    dataVersion: settlement.dataVersion,
  })
  response.headers.set(
    DATA_VERSION_RESPONSE_HEADER,
    String(settlement.dataVersion)
  )
  return response
})

export const registerD1DataRoutes = (
  app: Hono<RequestLoggingEnvironment>
): void => {
  app.route("/api/data", dataApp)
}
