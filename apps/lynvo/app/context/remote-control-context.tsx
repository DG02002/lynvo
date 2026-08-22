import React, {
  createContext,
  use,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react"
import { toast } from "sonner"
import { useRealtime } from "~/context/realtime-context"
import { remoteApi } from "./remote-control/api"
import { createRemoteControlMachine } from "./remote-control/machine"
import { createRemoteControlPersistence } from "./remote-control/storage"

declare global {
  interface RemoteControlContextValue {
    activeSessionId: string | null
    connectToSession: (sessionId: string, deviceName: string) => void
    disconnect: () => void
    sendRemotePlayback: (intent: RemotePlaybackIntent) => Promise<void>
    connectedDeviceName: string | null
    lastCommand: RemoteCommand | null
    acknowledgeCommand: (commandId: string) => void
    markCommandApplied: (commandId: string) => void
    failCommand: (commandId: string, message?: string) => Promise<void>
    controlledBy: string | null
    controllingDeviceName: string | null
    controllingDevices: readonly RemoteDevice[]
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
  clearInterval: (intervalId) => window.clearInterval(intervalId),
}

export const RemoteControlProvider = ({
  children,
  user,
}: {
  children: React.ReactNode
  user: { id: string; sessionId?: string } | null
}) => {
  const realtime = useRealtime()
  const identity = `${user?.id ?? "signed-out"}:${user?.sessionId ?? "none"}`
  const machine = useMemo(
    () =>
      createRemoteControlMachine({
        transport: remoteApi,
        persistence: createRemoteControlPersistence(identity),
        clock: browserClock,
      }),
    [identity]
  )
  const state = useSyncExternalStore(
    machine.subscribe,
    machine.getSnapshot,
    machine.getServerSnapshot
  )

  useEffect(
    () =>
      user?.sessionId
        ? machine.start(
            () => navigator.onLine && document.visibilityState === "visible"
          )
        : undefined,
    [machine, user?.sessionId]
  )
  useEffect(() => {
    if (!user?.sessionId) {
      return
    }
    const poll = () => {
      if (navigator.onLine) {
        void machine.poll().catch(console.error)
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        poll()
      }
    }
    window.addEventListener("online", poll)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("online", poll)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [machine, user?.sessionId])
  useEffect(() => {
    if (
      user?.sessionId &&
      realtime.connectionGeneration > 0 &&
      navigator.onLine
    ) {
      void machine.poll().catch(console.error)
    }
  }, [machine, realtime.connectionGeneration, user?.sessionId])
  useEffect(() => {
    machine.setRealtimeStatus(realtime.status)
  }, [machine, realtime.status])
  useEffect(
    () =>
      machine.subscribeOutcomes((outcome) => {
        if (outcome.type === "connected") {
          toast.success(`Connected to ${outcome.deviceName}.`)
        } else if (outcome.type === "connect-failed") {
          toast.error(
            "Remote Play couldn’t connect. Keep Lynvo open on both devices, then try again."
          )
        } else if (
          outcome.type === "disconnected" ||
          outcome.type === "receiver-disconnected"
        ) {
          toast.info("Remote Play disconnected")
        } else if (outcome.type === "disconnect-failed") {
          toast.error(
            "Remote Play couldn’t disconnect. Check the connection, then try again."
          )
        } else if (outcome.type === "send-failed") {
          toast.error(
            "The Remote Play command couldn’t be sent. Check the connection, then try again."
          )
        } else if (outcome.type === "delivery-unavailable") {
          toast.error(
            "Remote Play updates are temporarily unavailable. Check the connection."
          )
        } else if (outcome.type === "invalid-command") {
          toast.error("Remote Play received an invalid playback request.")
        } else if (outcome.type === "receiver-connected") {
          toast.info(`Connected to ${outcome.deviceName}`)
        } else if (outcome.type === "receiver-ended") {
          toast.info("Remote Play connection ended")
        } else if (outcome.command === "play") {
          toast.info("Playing on the connected device")
        }
      }),
    [machine]
  )

  useEffect(
    () =>
      realtime.subscribe((message) => {
        if (message.type === "remote.event") {
          machine.receiveRealtime(message.payload, user?.sessionId)
        } else if (message.type === "remote-inbox.changed") {
          void machine.poll().catch(console.error)
        }
      }),
    [machine, realtime, user?.sessionId]
  )

  const value = useMemo<RemoteControlContextValue>(
    () => ({
      activeSessionId: state.activeSessionId,
      connectToSession: (sessionId, deviceName) => {
        void machine.connect(sessionId, deviceName).catch(console.error)
      },
      disconnect: () => {
        void machine.disconnect().catch(console.error)
      },
      sendRemotePlayback: machine.sendRemotePlayback,
      connectedDeviceName: state.connectedDeviceName,
      lastCommand: state.lastCommand,
      acknowledgeCommand: machine.acknowledgeCommand,
      markCommandApplied: machine.markCommandApplied,
      failCommand: machine.failCommand,
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
