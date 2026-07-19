import { Hono } from "hono"
import { createExtractorRuntime } from "@lynvo/extractor-protocol"
import { validateBearerCredential } from "./auth"
import {
  createOfficialManifest,
  extractFromOfficialSource,
} from "./source-catalog"
import { logRequestEvent } from "./logger"
import {
  OfficialExtractorUsageLimiter,
  readUsage,
  reserveUsage,
  settleUsage,
} from "./usage-limiter"

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
      throw new Error("RATE_LIMITED")
    }

    let didSucceed = false
    try {
      const result = await extractFromOfficialSource(
        request,
        targetUrl,
        env.PUBLIC_ASSET_ORIGIN
      )
      didSucceed = true
      logRequestEvent({
        requestId: crypto.randomUUID(),
        operation: "extract",
        sourceId: result.source.sourceId,
        targetHost: new URL(targetUrl).hostname,
        inputKind: request.input.kind,
        resultNodeCount: result.nodes.length,
      })
      return result
    } finally {
      await settleUsage(env, didSucceed)
    }
  },
  onError: (error, { request }) => {
    const message = error instanceof Error ? error.message : "TEMPORARY_FAILURE"
    logRequestEvent({
      requestId: request.headers.get("cf-ray") ?? crypto.randomUUID(),
      operation: "extract",
      sourceId: undefined,
      errorCode: message,
    })
  },
})

const app = new Hono<{ Bindings: OfficialExtractorBindings }>()

app.get("/manifest", (context) =>
  runtime.handleManifest(context.req.raw, context.env)
)
app.post("/verify", (context) =>
  runtime.handleVerify(context.req.raw, context.env)
)
app.get("/usage", (context) =>
  runtime.handleUsage(context.req.raw, context.env)
)
app.post("/extract", (context) =>
  runtime.handleExtract(context.req.raw, context.env)
)
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
