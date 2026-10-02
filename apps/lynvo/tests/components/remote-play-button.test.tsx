import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RemotePlayButton } from "~/components/remote-play-button"
import { RemoteControlProviderContent } from "~/context/remote-control-context"

const fetchMock = vi.fn<typeof globalThis.fetch>()
const nativeFetch = globalThis.fetch
const machineSnapshot = {
  activeSessionId: null,
  connectedDeviceName: null,
  controlledBy: null,
  controllingDeviceName: null,
  controllingDevices: [],
  lastCommand: null,
} satisfies RemoteControlMachineState

const createMachine = (): RemoteControlMachine => ({
  getSnapshot: () => machineSnapshot,
  getServerSnapshot: () => machineSnapshot,
  subscribe: () => () => undefined,
  subscribeOutcomes: () => () => undefined,
  start: () => () => undefined,
  poll: vi.fn(async () => undefined),
  setRealtimeStatus: vi.fn(),
  connect: vi.fn(async () => undefined),
  disconnect: vi.fn(async () => undefined),
  disconnectReceiver: vi.fn(async () => undefined),
  sendRemotePlayback: vi.fn(async () => undefined),
  receiveCommand: vi.fn(() => false),
  receiveRealtime: vi.fn(),
  acknowledgeCommand: vi.fn(async () => undefined),
  markCommandApplied: vi.fn(),
  failCommand: vi.fn(async () => undefined),
})

const realtime = {
  status: "disconnected" as const,
  connectionGeneration: 0,
  subscribe: () => () => undefined,
}

const renderRemotePlayButton = (open: boolean) => (
  <RemoteControlProviderContent
    user={{ id: "user-one", sessionId: "session-one" }}
    realtime={realtime}
    createMachine={createMachine}
  >
    <RemotePlayButton trigger={null} open={open} />
  </RemoteControlProviderContent>
)

describe("RemotePlayButton", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="lynvo-user-id" content="user-one">
      <meta name="lynvo-session-id" content="session-one">
    `
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () =>
      Response.json({
        receivers: [
          {
            id: "living-room-session",
            deviceName: "Living room TV",
            lastActiveAt: 1,
            receiverId: "living-room-receiver",
          },
        ],
      })
    )
  })

  afterEach(() => {
    vi.stubGlobal("fetch", nativeFetch)
    document.head.innerHTML = ""
  })

  it("loads devices on every transition to open through the controlled prop", async () => {
    const { rerender } = render(renderRemotePlayButton(false))

    expect(fetchMock).not.toHaveBeenCalled()

    rerender(renderRemotePlayButton(true))

    expect(
      await screen.findByRole("button", { name: "Living room TV" })
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining("/api/remote/receivers")
    )

    rerender(renderRemotePlayButton(false))
    rerender(renderRemotePlayButton(true))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
