import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import TvAuth from "~/components/auth/TvAuth"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

describe("TV approval route behavior", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/tv?code=12345678")
  })

  it("submits approval through the same-origin Worker boundary", async () => {
    const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
      const url = new URL(
        request instanceof Request ? request.url : String(request),
        window.location.origin
      )
      return url.pathname.endsWith("/approval")
        ? Response.json({
            code: "12345678",
            status: "pending",
            expiresAt: Date.now() + 60_000,
            deviceName: "Living room TV",
          })
        : Response.json({ success: true })
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TvAuth user={{ username: "darshan" }} />
        </MemoryRouter>
      </QueryClientProvider>
    )
    const approveButton = await screen.findByRole("button", {
      name: "Log in this device",
    })
    await waitFor(() => expect(approveButton).toBeEnabled())
    fireEvent.click(approveButton)

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([request]) => {
          const requestUrl =
            request instanceof Request ? request.url : String(request)
          return (
            new URL(requestUrl, window.location.origin).pathname ===
            "/api/auth/tv/authorize"
          )
        })
      ).toBe(true)
    )
  })
})
