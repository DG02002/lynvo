import { Hono, type Context as HonoContext } from "hono"
import { Result, Schema } from "effect"
import {
  DEFAULT_RETENTION_DAYS,
  LINK_LIMIT_BYTES,
  MAX_RETENTION_DAYS,
  STORAGE_RETENTION_DAY_OPTIONS,
  USER_STORAGE_LIMIT_BYTES,
  USER_STORAGE_WARNING_BYTES,
} from "../constants"
import {
  addRequestContext,
  type RequestLoggingEnvironment,
} from "../request-logging"
import { isSameOriginRequest } from "../same-origin"
import { getD1Database } from "./db"
import { LinkTooLargeError, StorageLimitError } from "./errors"
import {
  applySavedLinkMetadataOperation,
  clearSavedLinks,
  countExpiredLinksForUser,
  createOrUpdateSavedLink,
  deleteExpiredLinksForUser,
  deleteSavedLinkById,
  getUserRetentionDays,
  listSavedLinks,
  updateSavedLinkMeta,
} from "./links"
import { enqueueSavedLinkExtraction } from "./link-extraction-queue"
import {
  deletePluginDomainById,
  listPluginDomains,
  upsertPluginDomain,
} from "./plugin-domains"
import {
  deletePluginServerById,
  listPluginServers,
  setPluginServerEnabled,
} from "./plugin-servers"
import {
  claimNextRemoteCommand,
  enqueueRemoteCommand,
  reportRemoteCommandResult,
} from "./remote-commands"
import { resolveD1Session } from "./sessions"
import type { SessionRecord } from "./sessions"
import {
  calculateAppOwnedStorageUsage,
  getStorageLedger,
} from "./storage-ledger"
import { normalizeRetentionDays, updateUserStorageRetentionDays } from "./users"
import { getUsage } from "./usage"
import { notifyAccountDataChanged } from "./data-version-notification"
import { processSavedLinkExtraction } from "../link-extraction-runner"
import { processMediaMetadataMaintenance } from "../media-metadata/media-metadata-coordinator"
import { lookupMediaArtwork } from "../media-metadata/media-artwork-lookup"
import { getDataVersion } from "./data-version"
import { getTitleGroupById, listTitleGroups } from "./title-groups"
import { MEDIA_ARTWORK_REQUEST_BATCH_LIMIT } from "../constants"

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

interface TmdbEnvironment {
  readonly TMDB_API_READ_ACCESS_TOKEN?: string
}

const triggerMetadataMaintenanceIfConfigured = (
  context: DataRouteContext,
  database: D1Database
): void => {
  const environmentWithOptionalToken: Env & TmdbEnvironment = context.env
  if (!environmentWithOptionalToken.TMDB_API_READ_ACCESS_TOKEN?.trim()) {
    return
  }
  safeWaitUntil(
    context,
    processMediaMetadataMaintenance(context.env, database).catch((error) => {
      console.error("media_metadata_maintenance_failed", error)
    })
  )
}

const LINK_NOT_FOUND_MESSAGE = "Link not found or no longer available"
const EXTRACTION_CONFLICT_MESSAGE =
  "Saved link extraction changed; refresh and retry"
const RETENTION_INVALID_MESSAGE = "Choose an available auto-delete period"
const REMOTE_TARGET_MISSING_MESSAGE = "Remote session not found"
const REMOTE_CLAIM_INACTIVE_MESSAGE = "Remote command claim is no longer active"
const PLUGIN_SERVER_DELETE_LIMIT_MESSAGE =
  "Plugin server cleanup exceeds the synchronous limit"

const respondDataFailure = async (
  context: DataRouteContext,
  status: DataFailureStatus,
  kind: string,
  message: string
): Promise<Response> =>
  await context.json({ failure: { kind, message } }, status)

const dataApp = new Hono<RequestLoggingEnvironment>()

dataApp.onError(async (error, context) => {
  if (error instanceof StorageLimitError) {
    return await context.json(
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
    return await context.json(
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
  const message = error instanceof Error ? error.message : String(error)
  if (message === LINK_NOT_FOUND_MESSAGE) {
    return await respondDataFailure(context, 404, "validation", message)
  }
  if (
    message === EXTRACTION_CONFLICT_MESSAGE ||
    message === REMOTE_CLAIM_INACTIVE_MESSAGE ||
    message === REMOTE_TARGET_MISSING_MESSAGE
  ) {
    return await respondDataFailure(context, 409, "validation", message)
  }
  if (
    message === RETENTION_INVALID_MESSAGE ||
    message === PLUGIN_SERVER_DELETE_LIMIT_MESSAGE
  ) {
    return await respondDataFailure(context, 400, "validation", message)
  }
  addRequestContext(context, {
    error: {
      type: error instanceof Error ? error.name : "UnknownError",
      message,
    },
  })
  return await respondDataFailure(
    context,
    500,
    "temporarily-unavailable",
    context.get("requestId")
  )
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
      response: await respondDataFailure(
        context,
        503,
        "service-unavailable",
        "Data storage is temporarily unavailable"
      ),
    }
  }
  if (options.mutating && !isSameOriginRequest(context.req.raw)) {
    return {
      kind: "terminated",
      response: await respondDataFailure(
        context,
        403,
        "csrf-expired",
        "Mutation forbidden"
      ),
    }
  }
  const session = await resolveD1Session(context.req.raw, database)
  if (!session) {
    return {
      kind: "terminated",
      response: await respondDataFailure(
        context,
        401,
        "session-expired",
        "Session expired"
      ),
    }
  }
  addRequestContext(context, { user_id: session.userId })
  return { kind: "ready", database, session }
}

const respondInvalidBody = async (
  context: DataRouteContext
): Promise<Response> =>
  respondDataFailure(context, 400, "validation", "Send a valid request.")

interface DataRequestBody<Body> {
  readonly kind: "body"
  readonly body: Body
}

interface DataRequestInvalid {
  readonly kind: "invalid"
  readonly response: Response
}

type DataRequestBodyResult<Body> = DataRequestBody<Body> | DataRequestInvalid

const readDataJsonBody = async <S extends Schema.Decoder<any>>(
  context: DataRouteContext,
  schema: S
): Promise<DataRequestBodyResult<Schema.Schema.Type<S>>> => {
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
  meta: Schema.optional(Schema.String),
  extractionState: Schema.optional(Schema.Literal("queued")),
})

const updateMetaSchema = Schema.Struct({
  operationId: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  meta: Schema.NonEmptyString,
})

const deleteLinkSchema = Schema.Struct({ id: Schema.NonEmptyString })

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

const pluginServerEnabledSchema = Schema.Struct({ enabled: Schema.Boolean })

const pluginDomainUpsertSchema = Schema.Struct({
  domain: Schema.NonEmptyString,
  pluginServerId: Schema.NonEmptyString,
  pluginId: Schema.NonEmptyString,
})

const remoteCommandEnqueueSchema = Schema.Struct({
  targetSessionId: Schema.NonEmptyString,
  targetReceiverId: Schema.NonEmptyString,
  command: Schema.Literal("play"),
  payload: Schema.String,
})

const remoteCommandClaimSchema = Schema.Struct({
  receiverId: Schema.NonEmptyString,
})

const remoteCommandResultSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  receiverId: Schema.NonEmptyString,
  claimToken: Schema.NonEmptyString,
  result: Schema.Literals(["applied", "failed"]),
  message: Schema.optional(Schema.String),
})

const mediaArtworkRequestItemSchema = Schema.Struct({
  title: Schema.NonEmptyString,
  mediaKind: Schema.optional(Schema.Literals(["movie", "tv"])),
  year: Schema.optional(Schema.Number),
  seasonNumber: Schema.optional(Schema.Number),
  episodeNumber: Schema.optional(Schema.Number),
})

const mediaArtworkRequestSchema = Schema.Struct({
  requests: Schema.Array(mediaArtworkRequestItemSchema),
})

dataApp.get("/links", async (context) => {
  addRequestContext(context, { operation: "data_links_list" })
  const preparation = await beginDataRequest(context, { mutating: false })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const snapshot = await listSavedLinks(
    preparation.database,
    preparation.session.userId,
    Date.now()
  )
  return context.json({ links: snapshot.results })
})

dataApp.get("/title-groups", async (context) => {
  addRequestContext(context, { operation: "data_title_groups_list" })
  const preparation = await beginDataRequest(context, { mutating: false })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const projection = await listTitleGroups(
    preparation.database,
    preparation.session.userId,
    Date.now()
  )
  const hasPendingGroups =
    projection.dateGroups.some((group) =>
      group.groups.some((titleGroup) => titleGroup.metadataState === "pending")
    ) ||
    projection.unmatchedGroups.some(
      (titleGroup) => titleGroup.metadataState === "pending"
    )
  if (hasPendingGroups) {
    triggerMetadataMaintenanceIfConfigured(context, preparation.database)
  }
  return context.json({
    ...projection,
    dataVersion: await getDataVersion(
      preparation.database,
      preparation.session.userId
    ),
  })
})

dataApp.get("/title-groups/:titleGroupId", async (context) => {
  addRequestContext(context, { operation: "data_title_group_read" })
  const preparation = await beginDataRequest(context, { mutating: false })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const group = await getTitleGroupById(
    preparation.database,
    preparation.session.userId,
    context.req.param("titleGroupId")
  )
  if (!group) {
    return respondDataFailure(
      context,
      404,
      "validation",
      "Title group not found"
    )
  }
  if (group.metadataState === "pending") {
    triggerMetadataMaintenanceIfConfigured(context, preparation.database)
  }
  return context.json({
    group,
    dataVersion: await getDataVersion(
      preparation.database,
      preparation.session.userId
    ),
  })
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
    return await respondDataFailure(
      context,
      400,
      "validation",
      "Too many artwork requests"
    )
  }
  const results = await lookupMediaArtwork(context.env, body.body.requests)
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
  const body = requestBody.body
  const now = Date.now()
  const result =
    body.extractionState === "queued"
      ? await enqueueSavedLinkExtraction(
          preparation.database,
          preparation.session.userId,
          { ...body, now }
        )
      : await createOrUpdateSavedLink(
          preparation.database,
          preparation.session.userId,
          { ...body, now }
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
  } else {
    triggerMetadataMaintenanceIfConfigured(context, preparation.database)
  }
  return context.json(result)
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
  const body = requestBody.body
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
  triggerMetadataMaintenanceIfConfigured(context, preparation.database)
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
  const body = requestBody.body
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
  triggerMetadataMaintenanceIfConfigured(context, preparation.database)
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
  const body = requestBody.body
  const result = await deleteSavedLinkById(
    preparation.database,
    preparation.session.userId,
    { id: body.id, now: Date.now() }
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
  const result = await clearSavedLinks(
    preparation.database,
    preparation.session.userId,
    { now: Date.now() }
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
  const expiredLinkCount = await countExpiredLinksForUser(
    preparation.database,
    preparation.session.userId,
    days,
    Date.now()
  )
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
  const body = requestBody.body
  const result = await updateUserStorageRetentionDays(
    preparation.database,
    preparation.session.userId,
    { days: body.days, now: Date.now() }
  )
  let deletedLinks = 0
  if (body.deleteExpiredLinks) {
    deletedLinks = await deleteExpiredLinksForUser(
      preparation.database,
      preparation.session.userId,
      body.days,
      Date.now()
    )
  }
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    result.dataVersion
  )
  return context.json({ ...result, deletedLinks })
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

dataApp.get("/plugin-servers", async (context) => {
  addRequestContext(context, { operation: "data_plugin_servers_read" })
  const preparation = await beginDataRequest(context, { mutating: false })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const servers = await listPluginServers(
    preparation.database,
    preparation.session.userId
  )
  return context.json({ servers })
})

dataApp.post("/plugin-servers/:pluginServerId/enabled", async (context) => {
  addRequestContext(context, { operation: "data_plugin_server_set_enabled" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(context, pluginServerEnabledSchema)
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const body = requestBody.body
  const result = await setPluginServerEnabled(
    preparation.database,
    preparation.session.userId,
    {
      id: context.req.param("pluginServerId"),
      enabled: body.enabled,
      now: Date.now(),
    }
  )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    result.dataVersion
  )
  return context.json(result)
})

dataApp.delete("/plugin-servers/:pluginServerId", async (context) => {
  addRequestContext(context, { operation: "data_plugin_server_delete" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const result = await deletePluginServerById(
    preparation.database,
    preparation.session.userId,
    {
      id: context.req.param("pluginServerId"),
      now: Date.now(),
    }
  )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    result.dataVersion
  )
  return context.json(result)
})

dataApp.get("/plugin-domains", async (context) => {
  addRequestContext(context, { operation: "data_plugin_domains_read" })
  const preparation = await beginDataRequest(context, { mutating: false })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const domains = await listPluginDomains(
    preparation.database,
    preparation.session.userId
  )
  return context.json({ domains })
})

dataApp.post("/plugin-domains", async (context) => {
  addRequestContext(context, { operation: "data_plugin_domain_upsert" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(context, pluginDomainUpsertSchema)
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const body = requestBody.body
  const result = await upsertPluginDomain(
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

dataApp.delete("/plugin-domains/:domainId", async (context) => {
  addRequestContext(context, { operation: "data_plugin_domain_delete" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const dataVersion = await deletePluginDomainById(
    preparation.database,
    preparation.session.userId,
    {
      domainId: context.req.param("domainId"),
      now: Date.now(),
    }
  )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    dataVersion
  )
  return context.json({ success: true, dataVersion })
})

dataApp.post("/remote-commands/enqueue", async (context) => {
  addRequestContext(context, { operation: "data_remote_command_enqueue" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(
    context,
    remoteCommandEnqueueSchema
  )
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const body = requestBody.body
  const result = await enqueueRemoteCommand(
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

dataApp.post("/remote-commands/claim", async (context) => {
  addRequestContext(context, { operation: "data_remote_command_claim" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(context, remoteCommandClaimSchema)
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const body = requestBody.body
  const claim = await claimNextRemoteCommand(
    preparation.database,
    preparation.session.userId,
    preparation.session.id,
    { receiverId: body.receiverId, now: Date.now() }
  )
  if (!claim) {
    return context.json({ commands: [] })
  }
  return context.json({
    commands: [
      {
        id: claim.id,
        claimToken: claim.claimToken,
        command: claim.command,
        payload: claim.payload,
        createdAt: claim.createdAt,
      },
    ],
  })
})

dataApp.post("/remote-commands/result", async (context) => {
  addRequestContext(context, { operation: "data_remote_command_result" })
  const preparation = await beginDataRequest(context, { mutating: true })
  if (!isReadyDataRequest(preparation)) {
    return preparation.response
  }
  const requestBody = await readDataJsonBody(context, remoteCommandResultSchema)
  if (requestBody.kind === "invalid") {
    return requestBody.response
  }
  const body = requestBody.body
  const result = await reportRemoteCommandResult(
    preparation.database,
    preparation.session.userId,
    preparation.session.id,
    { ...body, now: Date.now() }
  )
  await notifyAccountDataChanged(
    context.env,
    preparation.session.userId,
    result.dataVersion
  )
  return context.json(result)
})

export const registerD1DataRoutes = (
  app: Hono<RequestLoggingEnvironment>
): void => {
  app.route("/api/data", dataApp)
}
