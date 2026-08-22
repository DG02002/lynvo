import { Hono } from "hono"
import { createError, initLogger } from "evlog"
import { useLogger } from "evlog/hono"
import { Result, Schema } from "effect"
import {
  createPluginServerRuntime,
  extractErrorSchema,
  extractRequestSchema,
  extractSuccessSchema,
} from "@dg02002/lynvo-plugin-server-protocol"
import { validateBearerCredential } from "./auth"
import {
  createLynvoPluginServerManifest,
  discoverLynvoPlugin,
  extractWithLynvoPlugin,
} from "./plugin-catalog"
import {
  LynvoPluginServerUsageLimiter,
  readUsage,
  reserveUsage,
  settleUsage,
} from "./usage-limiter"
import {
  pluginServerRequestLogging,
  type PluginServerRequestLoggingEnvironment,
} from "./request-logging"

initLogger({
  env: { service: "lynvo-plugin-server" },
  sampling: {
    rates: { info: 10, warn: 100, error: 100 },
    keep: [{ status: 400 }],
  },
})

const runtime = createPluginServerRuntime<LynvoPluginServerBindings>({
  manifest: ({ env }) =>
    createLynvoPluginServerManifest(env.PUBLIC_ASSET_ORIGIN),
  auth: {
    validate: ({ request, env }) => {
      const apiKey = env.PLUGIN_SERVER_AUTH_KEY
      return apiKey ? validateBearerCredential(request, apiKey) : false
    },
  },
  usage: ({ env }) => readUsage(env),
  discover: ({ targetUrl }) => discoverLynvoPlugin(targetUrl),
  extract: async ({ request, targetUrl, env }) => {
    const log = useLogger()
    const reservation = await reserveUsage(env)
    log.set({
      extraction: {
        allowance_reservation_outcome: reservation.reserved
          ? "reserved"
          : "rejected",
      },
    })
    if (!reservation.reserved) {
      throw createError({
        message: "RATE_LIMITED",
        status: 429,
        why: "The Plugin Server has no remaining capacity for this period.",
        fix: "Retry after the usage window resets.",
      })
    }

    try {
      const result = await extractWithLynvoPlugin(
        request,
        targetUrl,
        env.PUBLIC_ASSET_ORIGIN
      )
      if (reservation.reservationId) {
        await settleUsage(env, true, reservation.reservationId)
        log.set({
          extraction: { allowance_settlement_outcome: "consumed" },
        })
      }
      return result
    } catch (extractionError) {
      if (reservation.reservationId) {
        try {
          await settleUsage(env, false, reservation.reservationId)
          log.set({
            extraction: { allowance_settlement_outcome: "released" },
          })
        } catch (settlementError) {
          log.set({
            extraction: { allowance_settlement_outcome: "failed" },
          })
          throw settlementError
        }
      }
      throw extractionError
    }
  },
  onError: () => {},
})

const app = new Hono<PluginServerRequestLoggingEnvironment>()

app.use("*", pluginServerRequestLogging())

app.get("/manifest", (context) => {
  context.get("log").set({ operation: "manifest" })
  return runtime.handleManifest(context.req.raw, context.env)
})
app.post("/verify", (context) => {
  context.get("log").set({ operation: "verify" })
  return runtime.handleVerify(context.req.raw, context.env)
})
app.get("/usage", (context) => {
  context.get("log").set({ operation: "usage" })
  return runtime.handleUsage(context.req.raw, context.env)
})
app.post("/discover", (context) => {
  context.get("log").set({ operation: "discover" })
  return runtime.handleDiscover(context.req.raw, context.env)
})
app.post("/extract", async (context) => {
  const requestBody = await context.req.raw
    .clone()
    .json()
    .catch(() => undefined)
  const parsedRequest =
    Schema.decodeUnknownResult(extractRequestSchema)(requestBody)
  const isRequestValid = Result.isSuccess(parsedRequest)
  const targetUrl = isRequestValid
    ? parsedRequest.success.input.kind === "source"
      ? parsedRequest.success.input.sourceUrl
      : parsedRequest.success.input.nodeUrl
    : undefined
  context.get("log").set({
    operation: "extract",
    extraction: {
      input_kind: isRequestValid ? parsedRequest.success.input.kind : "invalid",
      target_host: targetUrl ? new URL(targetUrl).hostname : undefined,
    },
  })
  const response = await runtime.handleExtract(context.req.raw, context.env)
  const responseBody = await response
    .clone()
    .json()
    .catch(() => undefined)
  const success = Schema.decodeUnknownResult(extractSuccessSchema)(responseBody)
  const failure = Schema.decodeUnknownResult(extractErrorSchema)(responseBody)
  const isSuccess = Result.isSuccess(success)
  const isFailure = Result.isSuccess(failure)
  context.get("log").set({
    extraction: {
      input_kind: isRequestValid ? parsedRequest.success.input.kind : "invalid",
      target_host: targetUrl ? new URL(targetUrl).hostname : undefined,
      node_count: isSuccess ? success.success.nodes.length : undefined,
      plugin_server_id: isSuccess
        ? success.success.plugin.pluginServerId
        : undefined,
      plugin_id: isSuccess ? success.success.plugin.pluginId : undefined,
      error_code: isFailure ? failure.success.error.code : undefined,
    },
  })
  return response
})
app.notFound(() =>
  Response.json(
    {
      ok: false,
      error: { code: "BAD_REQUEST", message: "Route not found." },
      extensions: {},
    },
    { status: 404 }
  )
)

export { LynvoPluginServerUsageLimiter }
export default app
