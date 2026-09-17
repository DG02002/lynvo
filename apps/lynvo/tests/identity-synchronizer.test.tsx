import { render, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { vi } from "vitest"

import {
  useEnsureSessionIdentity,
  IdentitySynchronizer,
} from "~/root/identity-synchronizer"

describe("identity synchronization", () => {
  it("accepts the successful signed-out session status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ status: "unauthenticated" }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <IdentitySynchronizer user={null}>{() => null}</IdentitySynchronizer>
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it("binds status validation to the rendered identity and coalesces races", async () => {
    let resolveStatus: (response: Response) => void = () => undefined
    const statusResponse = new Promise<Response>((resolve) => {
      resolveStatus = resolve
    })
    const fetchMock = vi.fn(() => statusResponse)
    vi.stubGlobal("fetch", fetchMock)

    render(
      <IdentitySynchronizer
        user={{ id: "rendered-user", sessionId: "rendered-session" }}
      >
        {(ensureIdentityIsSafe) => (
          <button onClick={ensureIdentityIsSafe}>Validate</button>
        )}
      </IdentitySynchronizer>
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event("focus"))
    window.dispatchEvent(new Event("online"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(requestUrl.searchParams.get("expectedUserId")).toBe("rendered-user")
    expect(requestUrl.searchParams.get("expectedSessionId")).toBe(
      "rendered-session"
    )

    resolveStatus(
      Response.json({
        status: "authenticated",
        userId: "rendered-user",
        sessionId: "rendered-session",
      })
    )
    await statusResponse
  })

  interface CapturedIdentityGate {
    ensureIdentity?: () => Promise<boolean>
  }

  it("gates the first action after visibility resume on session validation", async () => {
    let resolveResume: (response: Response) => void = () => undefined
    const resumeResponse = new Promise<Response>((resolve) => {
      resolveResume = resolve
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          status: "authenticated",
          userId: "rendered-user",
          sessionId: "rendered-session",
        })
      )
      .mockReturnValueOnce(resumeResponse)
    vi.stubGlobal("fetch", fetchMock)

    const captured: CapturedIdentityGate = {}
    const IdentityGateCapture = () => {
      const ensureIdentity = useEnsureSessionIdentity()
      useEffect(() => {
        captured.ensureIdentity = ensureIdentity
      }, [ensureIdentity])
      return null
    }

    render(
      <IdentitySynchronizer
        user={{ id: "rendered-user", sessionId: "rendered-session" }}
      >
        {() => <IdentityGateCapture />}
      </IdentitySynchronizer>
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    document.dispatchEvent(new Event("visibilitychange"))
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    document.dispatchEvent(new Event("visibilitychange"))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(captured.ensureIdentity).toBeDefined()
    if (!captured.ensureIdentity) {
      throw new Error("The identity gate was not provided")
    }
    const validation = captured.ensureIdentity()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    resolveResume(
      Response.json({
        status: "authenticated",
        userId: "rendered-user",
        sessionId: "rendered-session",
      })
    )
    await expect(validation).resolves.toBe(true)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
  })
})
