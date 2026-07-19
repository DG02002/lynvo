import { afterEach, describe, expect, it, vi } from "vitest"
import { Hono } from "hono"
import {
  addRequestContext,
  requestLogging,
  type RequestLoggingEnvironment,
} from "../workers/request-logging"
import { logger } from "../workers/logger"

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

afterEach(() => {
  vi.restoreAllMocks()
})

describe("request logging", () => {
  it("keeps production events as compact JSON", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    logger.info({
      event: "request_completed",
      service: "lynvo",
      environment: "production",
      timestamp: "2026-07-11T00:00:00.000Z",
      method: "GET",
      path: "/health",
      status_code: 200,
      outcome: "success",
      duration_ms: 2,
    })

    expect(info).toHaveBeenCalledOnce()
    expect(typeof info.mock.calls[0]?.[0]).toBe("string")
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toMatchObject({
      service: "lynvo",
      environment: "production",
      path: "/health",
    })
  })

  it("emits one pretty context-rich event for a successful local request", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = new Hono<RequestLoggingEnvironment>()
    app.use("*", requestLogging())
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
    expect(info).toHaveBeenCalledOnce()
    expect(error).not.toHaveBeenCalled()
    expect(info.mock.calls[0]?.[0]).toMatchObject({
      request: "GET /extract",
      result: expect.stringMatching(/^200 success in \d+ms$/),
      request_id: "request-123",
      context: {
        event: "request_completed",
        service: "lynvo",
        environment: "development",
        service_version: "1.2.3",
        commit_hash: "abc123",
        instance_id: "worker-version-id",
        request_id: "request-123",
        method: "GET",
        path: "/extract",
        status_code: 200,
        outcome: "success",
        operation: "link_extract",
        user_id: "user-123",
        extraction: { target_host: "example.com", link_count: 4 },
      },
    })
  })

  it("emits server failures at error level and replaces unsafe request IDs", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = new Hono<RequestLoggingEnvironment>()
    app.use("*", requestLogging())
    app.get("/failure", (context) => context.json({ error: "failed" }, 503))

    const response = await app.request(
      new Request("https://lynvo.example/failure", {
        headers: { "x-request-id": "invalid request id\n" },
      }),
      undefined,
      environment
    )
    const prettyEvent = error.mock.calls[0]?.[0]

    expect(info).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledOnce()
    expect(prettyEvent).toMatchObject({
      request: "GET /failure",
      result: expect.stringMatching(/^503 server_error in \d+ms$/),
      context: { outcome: "server_error", status_code: 503 },
    })
    expect(prettyEvent.request_id).not.toBe("invalid request id\n")
    expect(response.headers.get("x-request-id")).toBe(prettyEvent.request_id)
  })
})
