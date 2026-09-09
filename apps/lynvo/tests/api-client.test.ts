import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { client } from "~/lib/api/client"

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
    fetchMock.mockResolvedValue(Response.json({ success: true }))

    await client.settings.updatePlayerPreferences({
      payload: { rangeSupportedPlayerId: "vlc" },
    })

    const [input, init] = fetchMock.mock.calls[0]!
    const request = new Request(input, init)
    expect(new URL(request.url).pathname).toBe("/api/settings/player")
    expect(request.method).toBe("PATCH")
    expect(request.credentials).toBe("include")
    expect(request.headers.get("accept")).toBe("application/json")
    expect(request.headers.get("content-type")).toBe("application/json")
    expect(request.headers.get("x-csrf-token")).toBe("csrf-token")
    expect(request.headers.get("x-lynvo-expected-user-id")).toBe("user-1")
    expect(request.headers.get("x-lynvo-expected-session-id")).toBe("session-1")
    await expect(request.json()).resolves.toEqual({
      rangeSupportedPlayerId: "vlc",
    })
  })

  it("preserves tagged API errors and response metadata", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { _tag: "UnauthorizedError", message: "Unauthorized" },
        { status: 401, headers: { "Retry-After": "2" } }
      )
    )

    await expect(client.settings.listSessions()).rejects.toMatchObject({
      _tag: "UnauthorizedError",
      message: "Unauthorized",
      status: 401,
    })
  })
})
