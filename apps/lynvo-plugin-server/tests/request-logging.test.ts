import { Hono } from "hono"
import { initLogger, type DrainContext } from "evlog"
import { beforeAll, describe, expect, it } from "vitest"
import {
  pluginServerRequestLogging,
  type PluginServerRequestLoggingEnvironment,
} from "../src/request-logging"

beforeAll(() => {
  initLogger({ env: { service: "lynvo-plugin-server" }, silent: true })
})

// SAFETY: request-logging tests never call the Durable Object namespace.
const unusedUsageLimiter = {} as DurableObjectNamespace
const environment: LynvoPluginServerBindings = {
  ENVIRONMENT: "production",
  SERVICE_VERSION: "0.1.0",
  COMMIT_HASH: "unknown",
  CF_VERSION_METADATA: {
    id: "plugin-version",
    tag: "",
    timestamp: "2026-08-18T00:00:00.000Z",
  },
  PUBLIC_ASSET_ORIGIN: "http://localhost:5173/lynvo-plugin-server-assets",
  PLUGIN_SERVER_AUTH_KEY: "test-api-key",
  LYNVO_PLUGIN_SERVER_USAGE_LIMITER: unusedUsageLimiter,
}

describe("Plugin Server request logging", () => {
  it("emits one canonical hop event with propagated correlation IDs", async () => {
    const drained: DrainContext[] = []
    const app = new Hono<PluginServerRequestLoggingEnvironment>()
    app.use(
      "*",
      pluginServerRequestLogging({
        drain: (context) => {
          drained.push(context)
        },
      })
    )
    app.post("/extract", (context) => context.json({ ok: true }))

    const response = await app.request(
      new Request("https://plugin.example/extract", {
        method: "POST",
        headers: {
          "x-request-id": "request-one",
          "x-operation-id": "request-one:source",
        },
      }),
      undefined,
      environment
    )

    expect(response.headers.get("x-request-id")).toBe("request-one")
    expect(drained).toHaveLength(1)
    expect(drained[0]?.event).toMatchObject({
      request_id: "request-one",
      operation_id: "request-one:source",
      operation: "extract",
      outcome: "success",
      status: 200,
      duration_ms: expect.any(Number),
      service_version: "0.1.0",
      commit_hash: "unknown",
      instance_id: "plugin-version",
    })
  })

  it("records protocol failure diagnostics and force-retains the event", async () => {
    const drained: DrainContext[] = []
    let shouldKeep: boolean | undefined
    const app = new Hono<PluginServerRequestLoggingEnvironment>()
    app.use(
      "*",
      pluginServerRequestLogging({
        drain: (context) => {
          drained.push(context)
        },
        keep: ({ shouldKeep: nextShouldKeep }) => {
          shouldKeep = nextShouldKeep
        },
      })
    )
    app.post("/extract", (context) =>
      context.json(
        {
          ok: false,
          error: { code: "RATE_LIMITED", message: "Retry later." },
          extensions: {},
        },
        429
      )
    )

    await app.request(
      new Request("https://plugin.example/extract", { method: "POST" }),
      undefined,
      environment
    )

    expect(shouldKeep).toBe(true)
    expect(drained[0]?.event).toMatchObject({
      outcome: "failure",
      status: 429,
      retryable: true,
      failure_stage: "response",
      error_code: "RATE_LIMITED",
      duration_ms: expect.any(Number),
    })
  })
})
