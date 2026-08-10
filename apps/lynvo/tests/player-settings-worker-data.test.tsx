import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlayerSettings } from "~/features/site/settings/player-settings"
import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { createMemoryStorage } from "./memory-storage"

describe("Player settings browser data", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads Player settings through a same-origin Lynvo operation", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    const requestedPaths: Array<string> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          "https://lynvo.test"
        )
        requestedPaths.push(url.pathname)
        if (url.pathname === "/api/settings/player") {
          return Response.json({
            rangeSupportedPlayerId: "mpv",
            rangeUnsupportedPlayerId: "mx",
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
        <PlayerPreferenceProvider userId="test-user">
          <PlayerSettings />
        </PlayerPreferenceProvider>
      </QueryClientProvider>
    )

    const playerSelectors = await screen.findAllByRole("combobox")
    await waitFor(() => {
      expect(playerSelectors[0]).toHaveTextContent("MPV")
      expect(playerSelectors[1]).toHaveTextContent("MX Player")
    })
    expect(requestedPaths).toContain("/api/settings/player")
  })
})
