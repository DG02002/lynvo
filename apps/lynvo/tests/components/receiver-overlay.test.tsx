import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ReceiverOverlay } from "~/components/receiver-overlay"
import { RemoteControlProviderContent } from "~/context/remote-control-context"

describe("ReceiverOverlay", () => {
  it("moves focus to Disconnect and restores it to the previous control", async () => {
    let state: RemoteControlMachineState = {
      activeSessionId: null,
      connectedDeviceName: null,
      controlledBy: null,
      controllingDeviceName: null,
      controllingDevices: [],
      lastCommand: null,
      realtimeStatus: "connected",
      isConnecting: false,
      isDisconnecting: false,
    }
    let notify: (() => void) | undefined
    const disconnectReceiver = vi.fn(async () => {
      state = { ...state, controllingDevices: [] }
      notify?.()
    })
    const machine: RemoteControlMachine = {
      getSnapshot: () => state,
      getServerSnapshot: () => state,
      subscribe: (listener) => {
        notify = listener
        return () => {
          if (notify === listener) {
            notify = undefined
          }
        }
      },
      subscribeOutcomes: () => () => undefined,
      start: () => () => undefined,
      poll: async () => undefined,
      setRealtimeStatus: vi.fn(),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      disconnectReceiver,
      sendRemotePlayback: vi.fn(async () => undefined),
      receiveCommand: vi.fn(() => false),
      receiveRealtime: vi.fn(),
      acknowledgeCommand: vi.fn(async () => undefined),
      markCommandApplied: vi.fn(),
      failCommand: vi.fn(async () => undefined),
    }
    const createMachine = () => machine
    render(
      <RemoteControlProviderContent
        user={{ id: "user-1", sessionId: "session-1" }}
        realtime={{
          status: "connected",
          connectionGeneration: 0,
          subscribe: () => () => undefined,
        }}
        createMachine={createMachine}
        notifications={{
          showErrorToast: vi.fn(),
          showInfoToast: vi.fn(),
          showSuccessToast: vi.fn(),
        }}
      >
        <button type="button">Open Remote Play</button>
        <ReceiverOverlay />
      </RemoteControlProviderContent>
    )
    const previousControl = screen.getByRole("button", {
      name: "Open Remote Play",
    })
    previousControl.focus()

    await waitFor(() => expect(notify).toBeDefined())
    act(() => {
      state = {
        ...state,
        controllingDevices: [{ id: "controller-1", name: "Living room TV" }],
      }
      notify?.()
    })

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Disconnect" })).toHaveFocus()
    )

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }))
    expect(disconnectReceiver).toHaveBeenCalledOnce()

    await waitFor(() => expect(previousControl).toHaveFocus())
  })
})
