import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
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
}))

vi.mock("sonner", () => ({ toast: {} }))
vi.mock("~/context/realtime-context", () => ({
  useRealtime: () => ({
    status: "connected",
    connectionGeneration: 1,
    subscribe: mocks.subscribeRealtime,
  }),
}))
vi.mock("~/context/remote-control/machine", () => ({
  createRemoteControlMachine: () => ({
    getSnapshot: () => mocks.state,
    getServerSnapshot: () => mocks.state,
    subscribe: () => () => undefined,
    subscribeOutcomes: () => () => undefined,
    start: () => () => undefined,
    poll: mocks.poll,
    setRealtimeStatus: vi.fn(),
  }),
}))

import { RemoteControlProvider } from "~/context/remote-control-context"

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
      <RemoteControlProvider
        user={{ id: "user-one", sessionId: "session-one" }}
      >
        <div />
      </RemoteControlProvider>
    )

    await waitFor(() => expect(mocks.poll).toHaveBeenCalledOnce())
  })
})
