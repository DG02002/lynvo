import { render } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"

const { closeSocket, openRealtimeSocket } = vi.hoisted(() => {
  const closeSocket = vi.fn()
  return {
    closeSocket,
    openRealtimeSocket: vi.fn(() => closeSocket),
  }
})

vi.mock("~/context/realtime/socket", () => ({ openRealtimeSocket }))

import { RealtimeProvider } from "~/context/RealtimeContext"

beforeEach(() => {
  vi.clearAllMocks()
})

it("keeps the socket open when the same session object is recreated", () => {
  const { rerender } = render(
    <RealtimeProvider user={{ id: "user-1", sessionId: "session-1" }}>
      Content
    </RealtimeProvider>
  )

  rerender(
    <RealtimeProvider user={{ id: "user-1", sessionId: "session-1" }}>
      Content
    </RealtimeProvider>
  )

  expect(openRealtimeSocket).toHaveBeenCalledTimes(1)
  expect(closeSocket).not.toHaveBeenCalled()
})

it("closes the socket when the user logs out", () => {
  const { rerender } = render(
    <RealtimeProvider user={{ id: "user-1", sessionId: "session-1" }}>
      Content
    </RealtimeProvider>
  )

  rerender(<RealtimeProvider user={null}>Content</RealtimeProvider>)

  expect(closeSocket).toHaveBeenCalledTimes(1)
})
