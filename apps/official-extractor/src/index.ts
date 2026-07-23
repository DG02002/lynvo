import { Hono } from "hono"
import { createError, initLogger } from "evlog"
import { evlog, type EvlogVariables } from "evlog/hono"
import {
  createExtractorRuntime,
  extractErrorSchema,
  extractRequestSchema,
  extractSuccessSchema,
} from "@lynvo/extractor-protocol"
import { validateBearerCredential } from "./auth"
import {
  createOfficialManifest,
  extractFromOfficialSource,
} from "./source-catalog"
import {
  OfficialExtractorUsageLimiter,
  readUsage,
  reserveUsage,
  settleUsage,
} from "./usage-limiter"

initLogger({
  env: { service: "lynvo-official-extractor" },
})

const runtime = createExtractorRuntime<OfficialExtractorBindings>({
  manifest: ({ env }) => createOfficialManifest(env.PUBLIC_ASSET_ORIGIN),
  auth: {
    validate: ({ request, env }) => {
      const apiKey = env.OFFICIAL_EXTRACTOR_API_KEY
      return apiKey ? validateBearerCredential(request, apiKey) : false
    },
  },
  usage: ({ env }) => readUsage(env),
  extract: async ({ request, targetUrl, env }) => {
    const didReserve = await reserveUsage(env)
    if (!didReserve) {
      throw createError({
        message: "RATE_LIMITED",
        status: 429,
        why: "The extractor has no remaining capacity for this period.",
        fix: "Retry after the usage window resets.",
      })
    }

    let didSucceed = false
    try {
      const result = await extractFromOfficialSource(
        request,
        targetUrl,
        env.PUBLIC_ASSET_ORIGIN
      )
      didSucceed = true
      return result
    } finally {
      await settleUsage(env, didSucceed)
    }
  },
  onError: () => {},
})

interface OfficialExtractorEnvironment extends EvlogVariables {
  Bindings: OfficialExtractorBindings
}

const app = new Hono<OfficialExtractorEnvironment>()

app.use("*", evlog())

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
app.post("/extract", async (context) => {
  const requestBody = await context.req.raw
    .clone()
    .json()
    .catch(() => undefined)
  const parsedRequest = extractRequestSchema.safeParse(requestBody)
  const targetUrl = parsedRequest.success
    ? parsedRequest.data.input.kind === "source"
      ? parsedRequest.data.input.sourceUrl
      : parsedRequest.data.input.nodeUrl
    : undefined
  context.get("log").set({
    operation: "extract",
    extraction: {
      input_kind: parsedRequest.success
        ? parsedRequest.data.input.kind
        : "invalid",
      target_host: targetUrl ? new URL(targetUrl).hostname : undefined,
    },
  })
  const response = await runtime.handleExtract(context.req.raw, context.env)
  const responseBody = await response
    .clone()
    .json()
    .catch(() => undefined)
  const success = extractSuccessSchema.safeParse(responseBody)
  const failure = extractErrorSchema.safeParse(responseBody)
  context.get("log").set({
    extraction: {
      input_kind: parsedRequest.success
        ? parsedRequest.data.input.kind
        : "invalid",
      target_host: targetUrl ? new URL(targetUrl).hostname : undefined,
      node_count: success.success ? success.data.nodes.length : undefined,
      source_id: success.success ? success.data.source.sourceId : undefined,
      error_code: failure.success ? failure.data.error.code : undefined,
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

export { OfficialExtractorUsageLimiter }
export default app
