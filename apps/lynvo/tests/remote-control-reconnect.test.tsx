import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = {
  poll: vi.fn(async () => undefined),
  subscribeRealtime: vi.fn(() => () => undefined),
  state: {
    activeSessionId: null,
    connectedDeviceName: null,
    controlledBy: null,
    controllingDeviceName: null,
    controllingDevices: [],
    lastCommand: null,
  },
}

const createMachine = (): RemoteControlMachine => ({
  getSnapshot: () => mocks.state,
  getServerSnapshot: () => mocks.state,
  subscribe: () => () => undefined,
  subscribeOutcomes: () => () => undefined,
  start: () => () => undefined,
  poll: mocks.poll,
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

import { RemoteControlProviderContent } from "~/context/remote-control-context"

describe("Remote Play reconnect convergence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    })
  })

  it("polls the authoritative inbox after a hidden-tab reconnect", async () => {
    render(
      <RemoteControlProviderContent
        user={{ id: "user-one", sessionId: "session-one" }}
        realtime={{
          status: "connected",
          connectionGeneration: 1,
          subscribe: mocks.subscribeRealtime,
        }}
        createMachine={createMachine}
      >
        <div />
      </RemoteControlProviderContent>
    )

    await waitFor(() => expect(mocks.poll).toHaveBeenCalledOnce())
  })
})
