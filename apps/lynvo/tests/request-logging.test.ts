import { beforeAll, describe, expect, it } from "vitest"
import { Hono } from "hono"
import { initLogger, type DrainContext } from "evlog"
import {
  addRequestContext,
  requestLogging,
  type RequestLoggingEnvironment,
} from "../workers/request-logging"

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
      operation: "link_extract",
      user_id: "user-123",
      extraction: { target_host: "example.com", link_count: 4 },
    })
  })
})
