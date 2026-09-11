import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { UsageSettings } from "~/features/site/settings/usage-settings"
import { clearAsyncResourceCache } from "~/hooks/use-async-resource"
import { requestPathname } from "./support/request-pathname"
import { silenceConsoleErrorLogs } from "./support/silence-console-error-logs"

// Tests stub the same-origin fetch boundary.
const stubUsageFetch = (readLynvoUsage: () => Promise<Response> | Response) => {
  return vi.fn(async (request: RequestInfo | URL) => {
    const pathname = requestPathname(request)
    if (pathname === "/api/data/usage") {
      return await readLynvoUsage()
    }
    if (pathname === "/api/plugin-servers/usage") {
      return Response.json([])
    }
    throw new Error(`Unexpected request in test: ${pathname}`)
  })
}

describe("UsageSettings", () => {
  beforeEach(() => {
    clearAsyncResourceCache()
    silenceConsoleErrorLogs()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("renders an error with retry instead of the loading skeleton when usage fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      stubUsageFetch(async () => {
        throw new Error("network down")
      })
    )

    render(<UsageSettings lynvoPlugins={[]} userId="user-1" />)

    expect(
      await screen.findByRole("button", { name: "Try again" })
    ).toBeVisible()
    expect(screen.getByRole("alert")).toBeVisible()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.queryByText("Monthly usage limit")).not.toBeInTheDocument()
  })

  it("keeps cached usage visible and surfaces the error when a refresh fails", async () => {
    let usageRequestCount = 0
    vi.stubGlobal(
      "fetch",
      stubUsageFetch(() => {
        usageRequestCount += 1
        if (usageRequestCount === 1) {
          return Response.json({ metrics: [] })
        }
        throw new Error("network down")
      })
    )

    const { unmount } = render(
      <UsageSettings lynvoPlugins={[]} userId="user-1" />
    )
    expect(await screen.findByText("Monthly usage limit")).toBeVisible()
    unmount()

    // Age the cache entry past the TTL so the next mount revalidates.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000)

    render(<UsageSettings lynvoPlugins={[]} userId="user-1" />)

    expect(screen.getByText("Monthly usage limit")).toBeVisible()
    // The loaded view itself renders a usage progress bar, so rule out the
    // skeleton by its own marker instead.
    expect(
      document.querySelector('[data-slot="skeleton"]')
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "Try again" })
    ).toBeVisible()
    expect(screen.getByRole("alert")).toBeVisible()
  })

  it("loads usage after a successful retry", async () => {
    let usageRequestCount = 0
    vi.stubGlobal(
      "fetch",
      stubUsageFetch(() => {
        usageRequestCount += 1
        if (usageRequestCount === 1) {
          throw new Error("network down")
        }
        return Response.json({ metrics: [] })
      })
    )

    render(<UsageSettings lynvoPlugins={[]} userId="user-1" />)

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(await screen.findByText("Monthly usage limit")).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Try again" })
    ).not.toBeInTheDocument()
  })
})
