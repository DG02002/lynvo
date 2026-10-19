import { render, screen } from "@testing-library/react"
import { createMemoryRouter, Outlet, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import SaveList from "~/components/save-list"
import type { RealtimeContextValue } from "~/context/realtime-context"
import { RemoteControlProviderContent } from "~/context/remote-control-context"
import type { LinkViewItem } from "~/features/links/types"
import { clearLinksSnapshotStores } from "~/features/links/use-links"
import { setDevelopmentTvBroUiEnabled } from "~/lib/development-settings"

beforeEach(() => {
  setDevelopmentTvBroUiEnabled(false)
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
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

const renderLibrary = (initialItems?: LinkViewItem[]) => {
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
        children: [
          { path: "save", element: <SaveList initialItems={initialItems} /> },
        ],
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

describe("SaveList orchestrator", () => {
  it("renders the initial saved link through its session provider", async () => {
    clearLinksSnapshotStores()
    const initialItem: LinkViewItem = {
      id: "orchestrator-link",
      url: "https://media.example/orchestrator-link",
      timestamp: 1,
      title: "Orchestrator Link",
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: { extractedLinks: [] },
        playback: { openedUrls: [] },
      },
    }

    renderLibrary([initialItem])

    expect(await screen.findByText("Orchestrator Link")).toBeInTheDocument()
  })
})
