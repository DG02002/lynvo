import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DeviceApproval from "~/components/auth/device-approval"
import { requestPathname } from "./support/request-pathname"
import { silenceConsoleErrorLogs } from "./support/silence-console-error-logs"

describe("device approval route behavior", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/auth/device?user_code=NXSM-BKXB")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("submits approval through the same-origin authentication API", async () => {
    const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
      return requestPathname(request).endsWith("/approval")
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
      <MemoryRouter>
        <DeviceApproval />
      </MemoryRouter>
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
        fetchMock.mock.calls.some(
          ([request]) =>
            requestPathname(request) === "/api/auth/device/authorize"
        )
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

  it("shows an honest error with retry when the code check fails", async () => {
    silenceConsoleErrorLogs()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down")
      })
    )

    render(
      <MemoryRouter>
        <DeviceApproval />
      </MemoryRouter>
    )

    expect(
      await screen.findByRole("heading", { name: "Couldn’t check the code" })
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Code invalid or expired" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeVisible()
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Approve login" })
    ).not.toBeInTheDocument()
  })

  it("keeps the invalid-code heading when the server does not know the code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: RequestInfo | URL) =>
        requestPathname(request).endsWith("/approval")
          ? Response.json(null)
          : Response.json({ success: true })
      )
    )

    render(
      <MemoryRouter>
        <DeviceApproval />
      </MemoryRouter>
    )

    expect(
      await screen.findByRole("heading", { name: "Code invalid or expired" })
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Couldn’t check the code" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Try again" })
    ).not.toBeInTheDocument()
  })

  it("checks the code again after a failed check is retried", async () => {
    silenceConsoleErrorLogs()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockImplementation(async (request: RequestInfo | URL) => {
        return requestPathname(request).endsWith("/approval")
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
      <MemoryRouter>
        <DeviceApproval />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(
      await screen.findByRole("heading", { name: "Approve login" })
    ).toBeVisible()
    expect(screen.getByLabelText("Login verification code")).toHaveTextContent(
      "NXSM-BKXB"
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
