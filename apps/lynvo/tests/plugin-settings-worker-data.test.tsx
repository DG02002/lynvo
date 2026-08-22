import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PluginsSettings } from "~/features/site/settings/plugins-settings"

describe("Plugin settings browser data", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads Plugin settings through same-origin Lynvo operations", async () => {
    const requestedPaths: Array<string> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          "https://lynvo.test"
        )
        requestedPaths.push(url.pathname)
        if (url.pathname === "/api/plugin-servers") {
          return Response.json([
            {
              id: "plugin-server-1",
              userId: "user-1",
              baseUrl: "https://plugins.example.com",
              manifest: "{}",
              enabled: false,
              priority: 0,
              verificationStatus: "verified",
              createdAt: 1,
              updatedAt: 1,
            },
          ])
        }
        if (url.pathname === "/api/plugin-domains") {
          return Response.json([])
        }
        return new Response(null, { status: 404 })
      })
    )
    render(
      <PluginsSettings
        lynvoPlugins={null}
        requestOrigin="https://lynvo.test"
      />
    )

    expect(await screen.findByText("https://plugins.example.com")).toBeVisible()
    await waitFor(() => {
      expect(requestedPaths).toEqual(
        expect.arrayContaining(["/api/plugin-servers", "/api/plugin-domains"])
      )
    })
    expect(requestedPaths.every((path) => path.startsWith("/api/"))).toBe(true)
  })
})
