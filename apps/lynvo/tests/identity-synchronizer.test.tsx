import { render, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { vi } from "vitest"
import { IdentitySynchronizer } from "~/root/identity-synchronizer"

describe("identity synchronization", () => {
  it("accepts the successful signed-out session status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ status: "unauthenticated" }))
    vi.stubGlobal("fetch", fetchMock)
    const queryClient = new QueryClient()
    queryClient.setQueryData(["public-page"], "retained")

    render(
      <IdentitySynchronizer user={null} queryClient={queryClient}>
        {() => null}
      </IdentitySynchronizer>
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(queryClient.getQueryData(["public-page"])).toBe("retained")
    )
  })

  it("binds status validation to the rendered identity and coalesces races", async () => {
    let resolveStatus: (response: Response) => void = () => undefined
    const statusResponse = new Promise<Response>((resolve) => {
      resolveStatus = resolve
    })
    const fetchMock = vi.fn(() => statusResponse)
    vi.stubGlobal("fetch", fetchMock)

    const queryClient = new QueryClient()
    render(
      <IdentitySynchronizer
        user={{ id: "rendered-user", sessionId: "rendered-session" }}
        queryClient={queryClient}
      >
        {(validateIdentity) => (
          <button onClick={validateIdentity}>Validate</button>
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
})
