import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StorageSettings } from "~/features/site/settings/storage-settings"

describe("Storage settings browser data", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads storage usage through a same-origin Lynvo operation", async () => {
    const requestedPaths: Array<string> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          "https://lynvo.test"
        )
        requestedPaths.push(url.pathname)
        if (url.pathname === "/api/settings/storage") {
          return Response.json({
            estimatedBytes: 1_536,
            enforcedBytes: 1_024,
            operationalBytes: 512,
            linkBytes: 1_024,
            pluginServerBytes: 0,
            pluginDomainBytes: 0,
            authBytes: 512,
            profileBytes: 0,
            savedLinkCount: 2,
            averageLinkBytes: 512,
            storageLimitBytes: 10_240,
            storageWarningBytes: 8_192,
            linkLimitBytes: 4_096,
            retentionDays: 30,
            retentionDayOptions: [7, 30, 90],
            defaultRetentionDays: 30,
            maxRetentionDays: 90,
          })
        }
        return new Response(null, { status: 404 })
      })
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <StorageSettings />
      </QueryClientProvider>
    )

    expect(await screen.findByText("1.00 KB of 10.0 KB used")).toBeVisible()
    expect(
      screen.getByText(
        /Saved links and their extracted link data count toward this limit/
      )
    ).toBeVisible()
    expect(requestedPaths).toContain("/api/settings/storage")
  })
})
