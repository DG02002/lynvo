import { render, screen } from "@testing-library/react"
import { createMemoryRouter, Outlet, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import SaveList from "~/components/save-list"
import type { RealtimeContextValue } from "~/context/realtime-context"
import { RemoteControlProviderContent } from "~/context/remote-control-context"
import { setDevelopmentTvBroUiEnabled } from "~/lib/development-settings"

beforeEach(() => {
  setDevelopmentTvBroUiEnabled(false)
})

afterEach(() => {
  setDevelopmentTvBroUiEnabled(false)
})

const remoteControlState: RemoteControlMachineState = {
  activeSessionId: null,
  connectedDeviceName: null,
  controlledBy: null,
  controllingDeviceName: null,
  controllingDevices: [],
  lastCommand: null,
  realtimeStatus: "disconnected",
  isConnecting: false,
  isDisconnecting: false,
}

const createRemoteControlMachine = (): RemoteControlMachine => ({
  getSnapshot: () => remoteControlState,
  getServerSnapshot: () => remoteControlState,
  subscribe: () => () => undefined,
  subscribeOutcomes: () => () => undefined,
  connect: async () => undefined,
  disconnect: async () => undefined,
  disconnectReceiver: async () => undefined,
  sendRemotePlayback: async () => undefined,
  receiveCommand: () => false,
  setRealtimeStatus: () => undefined,
  receiveRealtime: () => undefined,
  poll: async () => undefined,
  acknowledgeCommand: async () => undefined,
  markCommandApplied: () => undefined,
  failCommand: async () => undefined,
  start: () => () => undefined,
})

const realtime: RealtimeContextValue = {
  status: "disabled",
  connectionGeneration: 0,
  subscribe: () => () => undefined,
}

const renderLibrary = () => {
  const router = createMemoryRouter(
    [
      {
        id: "root",
        path: "/",
        loader: () => ({ user: null, mediaView: "list" }),
        HydrateFallback: () => null,
        element: (
          <RemoteControlProviderContent
            user={null}
            realtime={realtime}
            createMachine={createRemoteControlMachine}
          >
            <Outlet />
          </RemoteControlProviderContent>
        ),
        children: [{ path: "save", element: <SaveList /> }],
      },
    ],
    { initialEntries: ["/save"] }
  )
  return render(<RouterProvider router={router} />)
}

describe("Library TV Bro profile", () => {
  it("hides the save input while the TV Bro profile is active", async () => {
    setDevelopmentTvBroUiEnabled(true)

    renderLibrary()

    await screen.findByText("No saved links yet")
    expect(screen.queryByRole("textbox", { name: "Link" })).toBeNull()
  })

  it("keeps the save input in the standard browser profile", async () => {
    renderLibrary()

    expect(
      await screen.findByRole("textbox", { name: "Link" })
    ).toBeInTheDocument()
  })
})
