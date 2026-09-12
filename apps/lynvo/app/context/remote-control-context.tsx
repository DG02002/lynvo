import React, {
  createContext,
  use,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react"
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from "~/lib/toast-notifications"
import {
  useRealtime,
  type RealtimeContextValue,
} from "~/context/realtime-context"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { remoteApi } from "./remote-control/api"
import { REMOTE_CONNECTION_FAILURE_MESSAGE } from "./remote-control/constants"
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

const createBrowserRemoteControlMachine = (identity: string) =>
  createRemoteControlMachine({
    transport: remoteApi,
    persistence: createRemoteControlPersistence(identity),
    clock: browserClock,
  })

type RemoteControlNotifications = {
  readonly showErrorToast: typeof showErrorToast
  readonly showInfoToast: typeof showInfoToast
  readonly showSuccessToast: typeof showSuccessToast
}

const browserRemoteControlNotifications: RemoteControlNotifications = {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
}

export const RemoteControlProviderContent = ({
  children,
  user,
  realtime,
  createMachine = createBrowserRemoteControlMachine,
  notifications = browserRemoteControlNotifications,
}: {
  children: React.ReactNode
  user: { id: string; sessionId?: string } | null
  realtime: RealtimeContextValue
  createMachine?: (identity: string) => RemoteControlMachine
  notifications?: RemoteControlNotifications
}) => {
  const identity = `${user?.id ?? "signed-out"}:${user?.sessionId ?? "none"}`
  const machine = useMemo(
    () => createMachine(identity),
    [createMachine, identity]
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
          notifications.showSuccessToast({
            title: `Connected to ${outcome.deviceName}`,
          })
        } else if (outcome.type === "connect-failed") {
          notifications.showErrorToast({
            title: "Remote Play couldn’t connect",
            description: "Keep Lynvo open on both devices, then try again.",
          })
        } else if (
          outcome.type === "disconnected" ||
          outcome.type === "receiver-disconnected"
        ) {
          notifications.showInfoToast({ title: "Remote Play disconnected" })
        } else if (outcome.type === "disconnect-failed") {
          notifications.showErrorToast({
            title: "Remote Play couldn’t disconnect",
            description: REMOTE_CONNECTION_FAILURE_MESSAGE,
          })
        } else if (outcome.type === "send-failed") {
          notifications.showErrorToast({
            title: "Couldn’t send the Remote Play command",
            description: getUserFacingErrorMessage(
              outcome.error,
              REMOTE_CONNECTION_FAILURE_MESSAGE
            ),
          })
        } else if (outcome.type === "delivery-unavailable") {
          notifications.showErrorToast({
            title: "Remote Play is temporarily unavailable",
            description:
              "Remote Play updates are temporarily unavailable. Check the connection.",
          })
        } else if (outcome.type === "invalid-command") {
          notifications.showErrorToast({
            title: "Invalid playback request",
            description: "Remote Play received an invalid playback request.",
          })
        }
      }),
    [machine, notifications]
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

export const RemoteControlProvider = ({
  children,
  user,
}: {
  children: React.ReactNode
  user: { id: string; sessionId?: string } | null
}) => {
  const realtime = useRealtime()
  return (
    <RemoteControlProviderContent user={user} realtime={realtime}>
      {children}
    </RemoteControlProviderContent>
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
