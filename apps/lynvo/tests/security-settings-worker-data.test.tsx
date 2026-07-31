import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SecuritySettings } from "~/features/site/settings/security-settings"

describe("Security settings browser data", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads active sessions through a same-origin Lynvo operation", async () => {
    const requestedPaths: Array<string> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          "https://lynvo.test"
        )
        requestedPaths.push(url.pathname)
        if (url.pathname === "/api/settings/security/sessions") {
          return Response.json([
            {
              id: "session-1",
              deviceName: "Darshan’s MacBook",
              lastActiveAt: 1_700_000_000_000,
              createdAt: 1_699_000_000_000,
              isCurrent: true,
            },
          ])
        }
        return new Response(null, { status: 404 })
      })
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SecuritySettings
          user={{ id: "user-1", username: "darshan", sid: "session-1" }}
          showActiveSessions
          onShowActiveSessionsChange={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(await screen.findByText("Darshan’s MacBook")).toBeVisible()
    expect(requestedPaths).toContain("/api/settings/security/sessions")
  })
})
