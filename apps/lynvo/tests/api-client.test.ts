import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { client, requestSameOrigin } from "~/lib/api/client"
import { readLynvoUsage } from "~/lib/settings/storage-http"
import { requestUrl } from "./support/request-inspection"

const fetchMock = vi.fn<typeof globalThis.fetch>()
const nativeFetch = globalThis.fetch

describe("browser API client", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="csrf-token" content="csrf-token">
      <meta name="lynvo-user-id" content="user-1">
      <meta name="lynvo-session-id" content="session-1">
    `
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.stubGlobal("fetch", nativeFetch)
    document.head.innerHTML = ""
  })

  it("sends same-origin API requests with session and CSRF headers", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ success: true, dataVersion: 2 })
    )

    await client.settings.updatePlayerPreferences({
      payload: { rangeSupportedPlayerId: "vlc" },
    })

    const [[input, init]] = fetchMock.mock.calls
    const request = new Request(
      new URL(requestUrl(input), window.location.href),
      init
    )
    expect(new URL(request.url).pathname).toBe("/api/settings/player")
    expect(request.method).toBe("PATCH")
    expect(request.credentials).toBe("same-origin")
    expect(request.headers.get("accept")).toBe("application/json")
    expect(request.headers.get("content-type")).toBe("application/json")
    expect(request.headers.get("x-csrf-token")).toBe("csrf-token")
    expect(request.headers.get("x-lynvo-expected-user-id")).toBe("user-1")
    expect(request.headers.get("x-lynvo-expected-session-id")).toBe("session-1")
    await expect(request.json()).resolves.toEqual({
      rangeSupportedPlayerId: "vlc",
    })
  })

  it("keeps raw same-origin callers on their exact header shape", async () => {
    fetchMock.mockResolvedValue(Response.json({ status: "pending" }))

    await requestSameOrigin("/api/auth/device/approval?code=abc", {
      headers: { "Content-Type": "application/json" },
    })

    const [[input, init]] = fetchMock.mock.calls
    const request = new Request(
      new URL(requestUrl(input), window.location.href),
      init
    )
    expect(request.credentials).toBe("same-origin")
    expect(request.headers.get("content-type")).toBe("application/json")
    expect(request.headers.get("accept")).toBeNull()
    expect(request.headers.get("x-csrf-token")).toBeNull()
    expect(request.headers.get("x-lynvo-expected-user-id")).toBe("user-1")
    expect(request.headers.get("x-lynvo-expected-session-id")).toBe("session-1")
  })

  it("preserves tagged API errors and response metadata", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          _tag: "UnauthorizedError",
          message: "Unauthorized",
          status: 999,
          headers: "spoofed",
        },
        { status: 401, headers: { "Retry-After": "2" } }
      )
    )

    await expect(client.settings.listSessions()).rejects.toMatchObject({
      _tag: "UnauthorizedError",
      message: "Unauthorized",
      status: 401,
      headers: expect.any(Headers),
    })
  })

  it("rejects successful responses that do not match the endpoint contract", async () => {
    fetchMock.mockResolvedValue(Response.json({ success: "true" }))

    await expect(
      client.settings.updatePlayerPreferences({
        payload: { rangeSupportedPlayerId: "vlc" },
      })
    ).rejects.toThrow()
  })

  it("uses the shared JSON transport and validates storage usage responses", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ metrics: [] }))

    await expect(readLynvoUsage()).resolves.toEqual({ metrics: [] })

    const [[input, init]] = fetchMock.mock.calls
    const request = new Request(input, init)
    expect(new URL(request.url).pathname).toBe("/api/data/usage")
    expect(request.credentials).toBe("same-origin")
    expect(request.headers.get("accept")).toBe("application/json")
    expect(request.headers.get("x-lynvo-expected-user-id")).toBe("user-1")
    expect(request.headers.get("x-lynvo-expected-session-id")).toBe("session-1")

    fetchMock.mockResolvedValueOnce(Response.json({ metrics: [{ id: "bad" }] }))

    await expect(readLynvoUsage()).rejects.toThrow()
  })
})
