import { render } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"

import { RealtimeProvider } from "~/context/realtime-context"

const closeSocket = vi.fn()
const openRealtimeSocket = vi.fn(
  (_options: { onSessionRevoked: () => void }) => ({
    close: closeSocket,
    sendSavedLinkRevision: vi.fn(),
  })
)

beforeEach(() => {
  vi.clearAllMocks()
})

it("keeps the socket open when the same session object is recreated", () => {
  const { rerender } = render(
    <RealtimeProvider
      user={{ id: "user-1", sessionId: "session-1" }}
      openSocket={openRealtimeSocket}
    >
      Content
    </RealtimeProvider>
  )

  rerender(
    <RealtimeProvider
      user={{ id: "user-1", sessionId: "session-1" }}
      openSocket={openRealtimeSocket}
    >
      Content
    </RealtimeProvider>
  )

  expect(openRealtimeSocket).toHaveBeenCalledTimes(1)
  expect(closeSocket).not.toHaveBeenCalled()
})

it("closes the old socket before reopening after a session rotation", () => {
  const { rerender } = render(
    <RealtimeProvider
      user={{ id: "user-1", sessionId: "session-1" }}
      openSocket={openRealtimeSocket}
    >
      Content
    </RealtimeProvider>
  )

  rerender(
    <RealtimeProvider
      user={{ id: "user-1", sessionId: "session-2" }}
      openSocket={openRealtimeSocket}
    >
      Content
    </RealtimeProvider>
  )

  expect(closeSocket).toHaveBeenCalledTimes(1)
  expect(openRealtimeSocket).toHaveBeenCalledTimes(2)
})

it("closes the socket when the user logs out", () => {
  const { rerender } = render(
    <RealtimeProvider
      user={{ id: "user-1", sessionId: "session-1" }}
      openSocket={openRealtimeSocket}
    >
      Content
    </RealtimeProvider>
  )

  rerender(
    <RealtimeProvider user={null} openSocket={openRealtimeSocket}>
      Content
    </RealtimeProvider>
  )

  expect(closeSocket).toHaveBeenCalledTimes(1)
})

it("forwards authoritative session revocation with the account identity", () => {
  const onSessionRevoked = vi.fn()
  render(
    <RealtimeProvider
      user={{ id: "user-1", sessionId: "session-1" }}
      onSessionRevoked={onSessionRevoked}
      openSocket={openRealtimeSocket}
    >
      Content
    </RealtimeProvider>
  )
  openRealtimeSocket.mock.calls[0]?.[0].onSessionRevoked()
  expect(onSessionRevoked).toHaveBeenCalledWith("user-1")
})
