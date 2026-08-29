import { beforeAll, describe, expect, it, vi } from "vitest"
import { Hono } from "hono"
import { initLogger, type DrainContext } from "evlog"
import {
  addRequestContext,
  requestLogging,
  type RequestLoggingEnvironment,
} from "../workers/request-logging"
import { responseSecurityHeaders } from "../workers/response-security-headers"

// SAFETY: Request logging only reads the release and environment fields supplied here.
const environment = {
  ENVIRONMENT: "test",
  SERVICE_VERSION: "1.2.3",
  COMMIT_HASH: "abc123",
  CF_VERSION_METADATA: {
    id: "worker-version-id",
    tag: "",
    timestamp: "2026-07-11T00:00:00.000Z",
  },
} as Env

beforeAll(() => {
  initLogger({ env: { service: "lynvo" }, silent: true })
})

describe("request logging", () => {
  it("emits one context-rich evlog event and preserves request IDs", async () => {
    const drained: DrainContext[] = []
    const app = new Hono<RequestLoggingEnvironment>()
    app.use(
      "*",
      requestLogging({
        drain: (context) => {
          drained.push(context)
        },
      })
    )
    app.get("/extract", (context) => {
      addRequestContext(context, {
        operation: "link_extract",
        user_id: "user-123",
        extraction: { target_host: "example.com", link_count: 4 },
      })
      return context.json({ ok: true })
    })

    const response = await app.request(
      new Request("https://lynvo.example/extract", {
        headers: { "x-request-id": "request-123" },
      }),
      undefined,
      environment
    )

    expect(response.headers.get("x-request-id")).toBe("request-123")
    expect(drained).toHaveLength(1)
    expect(drained[0]?.event).toMatchObject({
      service: "lynvo",
      request_id: "request-123",
      deployment_id: "worker-version-id",
      commit_hash: "abc123",
      service_version: "1.2.3",
      operation: "link_extract",
      user_id: "user-123",
      extraction: { target_host: "example.com", link_count: 4 },
    })
    expect(drained[0]?.event).not.toHaveProperty("instance_id")
    expect(drained[0]?.event).not.toHaveProperty("requestId")
  })

  it("emits a WebSocket upgrade without reusing the sealed logger", async () => {
    const drained: DrainContext[] = []
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    try {
      const app = new Hono<RequestLoggingEnvironment>()
      app.use("*", responseSecurityHeaders())
      app.use(
        "*",
        requestLogging({
          drain: (context) => {
            drained.push(context)
          },
        })
      )
      app.get("/realtime", (context) => {
        addRequestContext(context, {
          operation: "realtime_connect",
          transport: "websocket",
        })
        const response = context.body(null)
        Object.defineProperty(response, "status", { value: 101 })
        response.headers.set = () => {
          throw new TypeError("immutable WebSocket upgrade headers")
        }
        return response
      })

      const response = await app.request(
        new Request("https://lynvo.example/realtime", {
          headers: { Upgrade: "websocket" },
        }),
        undefined,
        environment
      )

      expect(response.status).toBe(101)
      expect(drained).toHaveLength(1)
      expect(drained[0]?.event).toMatchObject({
        operation: "realtime_connect",
        status: 101,
        transport: "websocket",
      })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it("completes expected failures with canonical diagnostic fields", async () => {
    const drained: DrainContext[] = []
    const app = new Hono<RequestLoggingEnvironment>()
    app.use(
      "*",
      requestLogging({
        drain: (context) => drained.push(context),
      })
    )
    app.get("/limited", (context) =>
      context.json(
        {
          code: "rate_limited",
          error: "Try again later.",
          retryable: true,
          requestId: context.get("requestId"),
        },
        429
      )
    )

    const response = await app.request(
      new Request("https://lynvo.example/limited", {
        headers: { "x-request-id": "request-limited" },
      }),
      undefined,
      environment
    )

    expect(response.headers.get("x-request-id")).toBe("request-limited")
    expect(await response.clone().json()).toMatchObject({
      requestId: "request-limited",
    })
    expect(drained).toHaveLength(1)
    expect(drained[0]?.event).toMatchObject({
      request_id: "request-limited",
      outcome: "failure",
      status: 429,
      retryable: true,
      failure_stage: "response",
      error_code: "rate_limited",
      duration_ms: expect.any(Number),
    })
  })

  it("redacts secrets and raw user content before adding domain fields", async () => {
    const drained: DrainContext[] = []
    const app = new Hono<RequestLoggingEnvironment>()
    app.use("*", requestLogging({ drain: (context) => drained.push(context) }))
    app.post("/safe-event", (context) => {
      addRequestContext(context, {
        operation: "redaction_check",
        user_id: "user-safe",
        target_host: "example.com",
        password: "password-value",
        token: "token-value",
        metadata: { title: "private-title" },
        raw_message: "private-socket-message",
        source_url: "https://example.com/private/path",
      })
      return context.json({ ok: true })
    })

    await app.request(
      new Request("https://lynvo.example/safe-event", { method: "POST" }),
      undefined,
      environment
    )

    const serializedEvent = JSON.stringify(drained[0]?.event)
    expect(serializedEvent).toContain("example.com")
    expect(serializedEvent).not.toContain("password-value")
    expect(serializedEvent).not.toContain("token-value")
    expect(serializedEvent).not.toContain("private-title")
    expect(serializedEvent).not.toContain("private-socket-message")
    expect(serializedEvent).not.toContain("/private/path")
  })

  it("force-retains failures during tail sampling", async () => {
    let shouldKeep: boolean | undefined
    const app = new Hono<RequestLoggingEnvironment>()
    app.use(
      "*",
      requestLogging({
        keep: (context) => {
          const { shouldKeep: contextShouldKeep } = context
          shouldKeep = contextShouldKeep
        },
      })
    )
    app.get("/failure", (context) => context.json({ ok: false }, 500))

    await app.request(
      new Request("https://lynvo.example/failure"),
      undefined,
      environment
    )

    expect(shouldKeep).toBe(true)
  })

  it("finalizes route exceptions handled as failure responses", async () => {
    const drained: DrainContext[] = []
    const app = new Hono<RequestLoggingEnvironment>()
    app.use(
      "*",
      requestLogging({
        drain: (context) => drained.push(context),
      })
    )
    app.get("/throws", () => {
      throw new Error("deliberate failure")
    })
    app.onError(() => new Response("failed", { status: 500 }))

    const response = await app.request(
      new Request("https://lynvo.example/throws", {
        headers: { "x-request-id": "request-thrown" },
      }),
      undefined,
      environment
    )

    expect(response.status).toBe(500)
    expect(drained).toHaveLength(1)
    expect(drained[0]?.event).toMatchObject({
      request_id: "request-thrown",
      outcome: "failure",
      status: 500,
      retryable: true,
      failure_stage: "response",
      error_code: "http_500",
      duration_ms: expect.any(Number),
    })
  })
})
