import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StorageSettings } from "~/features/site/settings/storage-settings"
import {
  USER_STORAGE_LIMIT_BYTES,
  USER_STORAGE_WARNING_BYTES,
} from "../workers/constants"

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
        if (url.pathname === "/api/data/storage-settings") {
          return Response.json({
            enforcedBytes: 1_024,
            linkBytes: 1_024,
            pluginServerBytes: 0,
            pluginDomainBytes: 0,
            profileBytes: 0,
            savedLinkCount: 2,
            averageLinkBytes: 512,
            storageLimitBytes: USER_STORAGE_LIMIT_BYTES,
            storageWarningBytes: USER_STORAGE_WARNING_BYTES,
            linkLimitBytes: 4_096,
            retentionDays: 30,
            retentionDayOptions: [7, 15, 30],
            defaultRetentionDays: 30,
            maxRetentionDays: 30,
          })
        }
        return new Response(null, { status: 404 })
      })
    )
    render(<StorageSettings />)

    expect(await screen.findByText("1.00 KB of 3.00 MB used")).toBeVisible()
    expect(
      screen.queryByText(
        /Saved links and their extracted link data count toward this limit/
      )
    ).not.toBeInTheDocument()
    expect(requestedPaths).toContain("/api/data/storage-settings")
  })
})
