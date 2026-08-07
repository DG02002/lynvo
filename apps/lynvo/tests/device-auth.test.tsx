import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import DeviceApproval from "~/components/auth/DeviceApproval"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

describe("device approval route behavior", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/auth/device?user_code=NXSM-BKXB")
  })

  it("submits approval through the same-origin authentication API", async () => {
    const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
      const url = new URL(
        request instanceof Request ? request.url : String(request),
        window.location.origin
      )
      return url.pathname.endsWith("/approval")
        ? Response.json({
            code: "NXSM-BKXB",
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
          <DeviceApproval />
        </MemoryRouter>
      </QueryClientProvider>
    )
    const approveButton = await screen.findByRole("button", {
      name: "Approve login",
    })
    expect(screen.getByLabelText("Login verification code")).toHaveTextContent(
      "NXSM-BKXB"
    )
    expect(screen.queryByText(/Living room TV/)).not.toBeInTheDocument()
    await waitFor(() => expect(approveButton).toBeEnabled())
    fireEvent.click(approveButton)

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([request]) => {
          const requestUrl =
            request instanceof Request ? request.url : String(request)
          return (
            new URL(requestUrl, window.location.origin).pathname ===
            "/api/auth/device/authorize"
          )
        })
      ).toBe(true)
    )
    expect(
      await screen.findByRole("heading", { name: "Login approved" })
    ).toBeVisible()
    expect(screen.getByText("The other device is now logged in.")).toBeVisible()
    expect(screen.getByRole("button", { name: "Go home" })).toHaveAttribute(
      "href",
      "/"
    )
  })
})
