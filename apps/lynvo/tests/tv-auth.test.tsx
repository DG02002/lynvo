import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import TvAuth from "~/components/auth/TvAuth"

vi.mock("convex/react", () => ({
  useQuery: () => ({
    status: "pending",
    expiresAt: Date.now() + 60_000,
    deviceName: "Living room TV",
  }),
  useMutation: () => vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

describe("TV approval route behavior", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/tv?code=12345678")
  })

  it("submits approval through the same-origin Worker boundary", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ success: true }, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <MemoryRouter>
        <TvAuth user={{ username: "darshan" }} />
      </MemoryRouter>
    )
    fireEvent.click(
      await screen.findByRole("button", { name: "Log in this device" })
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const request = fetchMock.mock.calls[0][0]
    const requestUrl =
      request instanceof Request ? request.url : String(request)
    expect(new URL(requestUrl, window.location.origin).pathname).toBe(
      "/api/auth/tv/authorize"
    )
  })
})
