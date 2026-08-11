import { render, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { vi } from "vitest"
import { IdentitySynchronizer } from "~/root/identity-synchronizer"

describe("identity synchronization", () => {
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
