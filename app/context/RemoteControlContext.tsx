import React, {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react"
import { toast } from "sonner"
import { useRealtime } from "~/context/RealtimeContext"
import { remoteApi } from "./remote-control/api"
import { useRemoteRealtimeEvents } from "./remote-control/events"
import { createRemoteControlMachine } from "./remote-control/machine"
import { remoteControlPersistence } from "./remote-control/storage"

declare global {
  interface RemoteControlContextValue {
    activeSessionId: string | null
    connectToSession: (sessionId: string, deviceName: string) => void
    disconnect: () => void
    sendCommand: (command: string, data?: unknown) => Promise<void>
    connectedDeviceName: string | null
    lastCommand: RemoteCommand | null
    acknowledgeCommand: (commandId: string) => void
    controlledBy: string | null
    controllingDeviceName: string | null
    controllingDevices: RemoteDevice[]
    handleReceiverDisconnect: () => Promise<void>
  }
}

const RemoteControlContext = createContext<
  RemoteControlContextValue | undefined
>(undefined)

const browserClock: RemoteControlClock = {
  now: Date.now,
  setInterval: (callback, intervalMs) =>
    window.setInterval(callback, intervalMs),
  clearInterval: (intervalId) => window.clearInterval(Number(intervalId)),
}

export const RemoteControlProvider = ({
  children,
  user,
}: {
  children: React.ReactNode
  user: { id: string; sessionId?: string } | null
}) => {
  const realtime = useRealtime()
  const machine = useMemo(
    () =>
      createRemoteControlMachine({
        transport: remoteApi,
        persistence: remoteControlPersistence,
        clock: browserClock,
      }),
    []
  )
  const state = useSyncExternalStore(
    machine.subscribe,
    machine.getSnapshot,
    machine.getSnapshot
  )

  useEffect(() => machine.start(), [machine])
  useEffect(() => {
    machine.setRealtimeStatus(realtime.status)
  }, [machine, realtime.status])
  useEffect(
    () =>
      machine.subscribeOutcomes((outcome) => {
        if (outcome.type === "connected") {
          toast.success(`Connected to ${outcome.deviceName}.`)
        } else if (outcome.type === "connect-failed") {
          toast.error("Unable to connect. Check both devices and try again.")
        } else if (
          outcome.type === "disconnected" ||
          outcome.type === "receiver-disconnected"
        ) {
          toast.info("Disconnected")
        } else if (outcome.type === "disconnect-failed") {
          toast.error("Unable to disconnect. Try again.")
        } else if (outcome.type === "send-failed") {
          toast.error(
            "Unable to send the command. Check the connection and try again."
          )
        } else if (outcome.type === "receiver-connected") {
          toast.info(`Connected to ${outcome.deviceName}`)
        } else if (outcome.type === "receiver-ended") {
          toast.info("Remote connection ended")
        } else if (outcome.command === "play") {
          toast.info("Remote: Playing")
        } else if (outcome.command === "pause") {
          toast.info("Remote: Paused")
        }
      }),
    [machine]
  )

  const receiveRealtime = useCallback(
    (event: RemoteRealtimeEvent) =>
      machine.receiveRealtime(event, user?.sessionId),
    [machine, user?.sessionId]
  )
  useRemoteRealtimeEvents(receiveRealtime)

  const value = useMemo<RemoteControlContextValue>(
    () => ({
      activeSessionId: state.activeSessionId,
      connectToSession: (sessionId, deviceName) => {
        void machine.connect(sessionId, deviceName).catch(console.error)
      },
      disconnect: () => {
        void machine.disconnect().catch(console.error)
      },
      sendCommand: machine.send,
      connectedDeviceName: state.connectedDeviceName,
      lastCommand: state.lastCommand,
      acknowledgeCommand: machine.acknowledgeCommand,
      controlledBy: state.controlledBy,
      controllingDeviceName: state.controllingDeviceName,
      controllingDevices: state.controllingDevices,
      handleReceiverDisconnect: machine.disconnectReceiver,
    }),
    [machine, state]
  )

  return (
    <RemoteControlContext.Provider value={value}>
      {children}
    </RemoteControlContext.Provider>
  )
}

export const useRemoteControl = () => {
  const context = use(RemoteControlContext)
  if (context === undefined) {
    throw new Error(
      "useRemoteControl must be used within a RemoteControlProvider"
    )
  }
  return context
}
