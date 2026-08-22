import { Hono, type Context as HonoContext } from "hono"
import { z } from "zod"
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

type DataRouteContext = HonoContext<RequestLoggingEnvironment>

type DataFailureStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503

const LINK_NOT_FOUND_MESSAGE = "Link not found or no longer available"
const EXTRACTION_CONFLICT_MESSAGE =
  "Saved link extraction changed; refresh and retry"
const RETENTION_INVALID_MESSAGE = "Choose an available auto-delete period"
const REMOTE_TARGET_MISSING_MESSAGE = "Remote session not found"
const REMOTE_CLAIM_INACTIVE_MESSAGE = "Remote command claim is no longer active"
const PLUGIN_SERVER_DELETE_LIMIT_MESSAGE =
  "Plugin server cleanup exceeds the synchronous limit"

const validationFailure = (message: string): SavedLinkCommandFailure => ({
  kind: "validation",
  message,
})

const unavailableFailure = (reference: string): SavedLinkCommandFailure => ({
  kind: "temporarily-unavailable",
  reference,
})

const failureResponse = async (
  context: DataRouteContext,
  status: DataFailureStatus,
  failure: SavedLinkCommandFailure
): Promise<Response> => await context.json({ failure }, status)

const dataApp = new Hono<RequestLoggingEnvironment>()

dataApp.onError(async (error, context) => {
  if (error instanceof StorageLimitError) {
    return await failureResponse(context, 422, {
      kind: "storage-limit",
      usedBytes: error.usedBytes,
      limitBytes: error.limitBytes,
    })
  }
  if (error instanceof LinkTooLargeError) {
    return await failureResponse(context, 422, {
      kind: "link-too-large",
      sizeBytes: error.sizeBytes,
      limitBytes: error.limitBytes,
    })
  }
  const message = error instanceof Error ? error.message : String(error)
  if (message === LINK_NOT_FOUND_MESSAGE) {
    return await failureResponse(context, 404, validationFailure(message))
  }
  if (
    message === EXTRACTION_CONFLICT_MESSAGE ||
    message === REMOTE_CLAIM_INACTIVE_MESSAGE ||
    message === REMOTE_TARGET_MISSING_MESSAGE
  ) {
    return await failureResponse(context, 409, validationFailure(message))
  }
  if (
    message === RETENTION_INVALID_MESSAGE ||
    message === PLUGIN_SERVER_DELETE_LIMIT_MESSAGE
  ) {
    return await failureResponse(context, 400, validationFailure(message))
  }
  addRequestContext(context, {
    error: {
      type: error instanceof Error ? error.name : "UnknownError",
      message,
    },
  })
  return await failureResponse(
    context,
    500,
    unavailableFailure(context.get("requestId"))
  )
})

interface ReadyDataRequest {
  readonly kind: "ready"
  readonly database: D1Database
  readonly session: SessionRecord
}

interface RespondedDataRequest {
  readonly kind: "responded"
  readonly response: Response
}

type DataRequestPreparation = ReadyDataRequest | RespondedDataRequest

const beginDataRequest = async (
  context: DataRouteContext,
  input: { readonly mutating: boolean }
): Promise<DataRequestPreparation> => {
  const database = getD1Database(context.env)
  if (!database) {
    return {
      kind: "responded",
      response: await failureResponse(
        context,
        503,
        unavailableFailure("d1-unbound")
      ),
    }
  }
  if (input.mutating && !isSameOriginRequest(context.req.raw)) {
    addRequestContext(context, { data_route_outcome: "cross_origin_rejected" })
    return {
      kind: "responded",
      response: await failureResponse(context, 403, { kind: "csrf-expired" }),
    }
  }
  const session = await resolveD1Session(context.req.raw, database)
  if (!session) {
    return {
      kind: "responded",
      response: await failureResponse(context, 401, {
        kind: "session-expired",
      }),
    }
  }
  return { kind: "ready", database, session }
}

const isReadyDataRequest = (
  preparation: DataRequestPreparation
): preparation is ReadyDataRequest => preparation.kind === "ready"

const respondInvalidBody = async (
  context: DataRouteContext
): Promise<Response> =>
  failureResponse(context, 400, validationFailure("Send a valid request."))

interface DataRequestBody<Body> {
  readonly kind: "body"
  readonly body: Body
}

interface DataRequestInvalid {
  readonly kind: "invalid"
  readonly response: Response
}

type DataRequestBodyResult<Body> = DataRequestBody<Body> | DataRequestInvalid

const readDataJsonBody = async <Schema extends z.ZodType>(
  context: DataRouteContext,
  schema: Schema
): Promise<DataRequestBodyResult<z.infer<Schema>>> => {
  let payload: unknown
  try {
    payload = await context.req.json()
  } catch {
    return { kind: "invalid", response: await respondInvalidBody(context) }
  }
  const parsed = schema.safeParse(payload)
  return parsed.success
    ? { kind: "body", body: parsed.data }
    : { kind: "invalid", response: await respondInvalidBody(context) }
}

const notifyAccountDataChanged = async (
  env: Env,
  userId: string,
  version: number
): Promise<void> => {
  await env.USER_REALTIME_ROOM?.getByName(userId).fetch(
    new Request("https://realtime.internal/notify-data-changed", {
      method: "POST",
      body: JSON.stringify({ version }),
    })
  )
}

const operationIdSchema = z.object({ operationId: z.string().min(1) })

const createOrUpdateSchema = operationIdSchema.extend({
  url: z.string().min(1),
  title: z.string().optional(),
  meta: z.string().optional(),
})

const updateMetaSchema = z.object({
  operationId: z.string().min(1),
  id: z.string().min(1),
  meta: z.string().min(1),
})

const deleteLinkSchema = z.object({ id: z.string().min(1) })

const metadataOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("markOpened"),
    linkUrl: z.string().min(1),
  }),
  z.object({
    kind: z.literal("cacheMirrors"),
    lazyItemUrl: z.string().min(1),
    mirrorsJson: z.string().min(1),
  }),
  z.object({
    kind: z.literal("removeExtractedLink"),
    linkKey: z.string().min(1),
    linkUrl: z.string().min(1),
  }),
  z.object({
    kind: z.literal("replaceExtraction"),
    expectedExtractionJson: z.string(),
    extractedLinksJson: z.string(),
  }),
])

const applyMetadataOperationSchema = z.object({
  operationId: z.string().min(1),
  id: z.string().min(1),
  operation: metadataOperationSchema,
})

const retentionDaysSchema = z.object({
  days: z.number().int(),
  deleteExpiredLinks: z.boolean().optional(),
})

const pluginServerEnabledSchema = z.object({ enabled: z.boolean() })

const pluginDomainUpsertSchema = z.object({
  domain: z.string().min(1),
  pluginServerId: z.string().min(1),
  pluginId: z.string().min(1),
})

const remoteCommandEnqueueSchema = z.object({
  targetSessionId: z.string().min(1),
  targetReceiverId: z.string().min(1),
  command: z.literal("play"),
  payload: z.string(),
})

const remoteCommandClaimSchema = z.object({ receiverId: z.string().min(1) })

const remoteCommandResultSchema = z.object({
  id: z.string().min(1),
  receiverId: z.string().min(1),
  claimToken: z.string().min(1),
  result: z.enum(["applied", "failed"]),
  message: z.string().optional(),
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
  const result = await createOrUpdateSavedLink(
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
