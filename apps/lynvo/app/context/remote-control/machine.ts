import { REMOTE_POLL_INTERVAL_MS } from "./constants"
import {
  createRemoteCommandDelivery,
  parseRemoteCommandWirePayload,
} from "./command-delivery"

declare global {
  interface RemoteDevice {
    id: string
    name: string
  }

  interface RemoteControlMachineState {
    activeSessionId: string | null
    connectedDeviceName: string | null
    controlledBy: string | null
    controllingDeviceName: string | null
    controllingDevices: RemoteDevice[]
    lastCommand: RemoteCommand | null
    realtimeStatus: string
    isConnecting: boolean
    isDisconnecting: boolean
  }

  interface RemotePollResponse {
    controlledBy?: string | null
    controllerName?: string | null
    controllingDevices?: RemoteDevice[]
    activeTargets?: string[]
    commands?: readonly RemoteCommandWireFields[]
  }

  interface RemoteRealtimeEvent {
    kind?: string
    id?: string
    command?: string
    payload?: unknown
    createdAt?: number
    controllingDevices?: RemoteDevice[]
    activeTargets?: string[]
    targetSessionId?: string
  }

  interface RemoteControlTransport {
    connect: (targetSessionId: string) => Promise<unknown>
    disconnect: (targetSessionId: string) => Promise<unknown>
    send: (
      targetSessionId: string,
      intent: RemotePlaybackIntent
    ) => Promise<unknown>
    poll: () => Promise<RemotePollResponse>
    reportResult: (
      commandId: string,
      result: "applied" | "failed",
      message?: string
    ) => Promise<unknown>
  }

  interface RemoteControlPersistence {
    load: () => {
      sessionId: string | null
      deviceName: string | null
    }
    save: (sessionId: string, deviceName: string) => void
    clear: () => void
    loadDelivery: () => RemoteCommandDeliveryRecord
    saveDelivery: (record: RemoteCommandDeliveryRecord) => void
  }

  interface RemoteControlClock {
    now: () => number
    setInterval: (callback: () => void, intervalMs: number) => unknown
    clearInterval: (intervalId: unknown) => void
  }

  interface RemoteControlOutcome {
    type:
      | "connected"
      | "connect-failed"
      | "disconnected"
      | "disconnect-failed"
      | "receiver-disconnected"
      | "send-failed"
      | "receiver-connected"
      | "receiver-ended"
      | "command-received"
      | "invalid-command"
      | "delivery-unavailable"
    deviceName?: string
    command?: "play"
  }

  interface RemoteControlMachine {
    getSnapshot: () => RemoteControlMachineState
    getServerSnapshot: () => RemoteControlMachineState
    subscribe: (listener: () => void) => () => void
    subscribeOutcomes: (
      listener: (outcome: RemoteControlOutcome) => void
    ) => () => void
    connect: (sessionId: string, deviceName: string) => Promise<void>
    disconnect: () => Promise<void>
    disconnectReceiver: () => Promise<void>
    sendRemotePlayback: (intent: RemotePlaybackIntent) => Promise<void>
    receiveCommand: (command: RemoteCommandDeliveryInput) => boolean
    setRealtimeStatus: (status: string) => void
    receiveRealtime: (
      event: RemoteRealtimeEvent,
      userSessionId?: string
    ) => void
    poll: () => Promise<void>
    acknowledgeCommand: (commandId: string) => Promise<void>
    markCommandApplied: (commandId: string) => void
    failCommand: (commandId: string, message?: string) => Promise<void>
    start: (shouldPoll?: () => boolean) => () => void
  }
}

const EMPTY_STATE: RemoteControlMachineState = {
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

const haveSameDevices = (
  currentDevices: RemoteDevice[],
  nextDevices: RemoteDevice[]
) => {
  if (currentDevices.length !== nextDevices.length) {
    return false
  }
  const currentById = new Map(
    currentDevices.map((device) => [device.id, device.name])
  )
  return nextDevices.every(
    (device) => currentById.get(device.id) === device.name
  )
}

export const createRemoteControlMachine = ({
  transport,
  persistence,
  clock,
}: {
  transport: RemoteControlTransport
  persistence: RemoteControlPersistence
  clock: RemoteControlClock
}): RemoteControlMachine => {
  const storedSession = persistence.load()
  let state: RemoteControlMachineState = {
    ...EMPTY_STATE,
    activeSessionId: storedSession.sessionId,
    connectedDeviceName: storedSession.deviceName,
  }
  const listeners = new Set<() => void>()
  const outcomeListeners = new Set<(outcome: RemoteControlOutcome) => void>()
  const delivery = createRemoteCommandDelivery({
    reportApplied: (commandId) => transport.reportResult(commandId, "applied"),
    now: clock.now,
    persistence,
  })

  const publish = (nextState: RemoteControlMachineState) => {
    state = nextState
    listeners.forEach((listener) => listener())
  }
  const publishOutcome = (outcome: RemoteControlOutcome) =>
    outcomeListeners.forEach((listener) => listener(outcome))

  const syncDeliveryState = () => {
    const lastCommand = delivery.getSnapshot().lastCommand
    if (state.lastCommand === lastCommand) {
      return
    }
    publish({
      ...state,
      lastCommand,
    })
  }

  const receiveCommand = (command: RemoteCommandDeliveryInput) => {
    const didReceive = delivery.receive(command)
    syncDeliveryState()
    if (didReceive) {
      publishOutcome({ type: "command-received", command: command.command })
    }
    return didReceive
  }

  const syncDevices = (nextDevices: RemoteDevice[]) => {
    if (haveSameDevices(state.controllingDevices, nextDevices)) {
      return
    }
    const hadDevices = state.controllingDevices.length > 0
    publish({
      ...state,
      controlledBy: nextDevices[0]?.id ?? null,
      controllingDeviceName: nextDevices[0]?.name ?? null,
      controllingDevices: nextDevices,
    })
    if (!hadDevices && nextDevices.length > 0) {
      publishOutcome({
        type: "receiver-connected",
        deviceName: nextDevices.map((device) => device.name).join(", "),
      })
    } else if (hadDevices && nextDevices.length === 0) {
      publishOutcome({ type: "receiver-ended" })
    }
  }

  const disconnectMissingTarget = (activeTargets?: string[]) => {
    if (
      activeTargets !== undefined &&
      state.activeSessionId &&
      !activeTargets.includes(state.activeSessionId)
    ) {
      persistence.clear()
      publish({
        ...state,
        activeSessionId: null,
        connectedDeviceName: null,
      })
      publishOutcome({ type: "disconnected" })
    }
  }

  const machine: RemoteControlMachine = {
    getSnapshot: () => state,
    getServerSnapshot: () => EMPTY_STATE,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    subscribeOutcomes: (listener) => {
      outcomeListeners.add(listener)
      return () => outcomeListeners.delete(listener)
    },
    connect: async (sessionId, deviceName) => {
      if (state.isConnecting || state.activeSessionId === sessionId) {
        return
      }
      publish({ ...state, isConnecting: true })
      try {
        await transport.connect(sessionId)
        persistence.save(sessionId, deviceName)
        publish({
          ...state,
          activeSessionId: sessionId,
          connectedDeviceName: deviceName,
          isConnecting: false,
        })
        publishOutcome({ type: "connected", deviceName })
      } catch (error) {
        publish({ ...state, isConnecting: false })
        publishOutcome({ type: "connect-failed", deviceName })
        throw error
      }
    },
    disconnect: async () => {
      if (state.isDisconnecting || !state.activeSessionId) {
        return
      }
      const targetSessionId = state.activeSessionId
      publish({ ...state, isDisconnecting: true })
      try {
        await transport.disconnect(targetSessionId)
        persistence.clear()
        publish({
          ...state,
          activeSessionId: null,
          connectedDeviceName: null,
          isDisconnecting: false,
        })
        publishOutcome({ type: "disconnected" })
      } catch (error) {
        publish({ ...state, isDisconnecting: false })
        publishOutcome({ type: "disconnect-failed" })
        throw error
      }
    },
    disconnectReceiver: async () => {
      await transport.disconnect("current")
      syncDevices([])
      publishOutcome({ type: "receiver-disconnected" })
    },
    sendRemotePlayback: async (intent) => {
      if (!state.activeSessionId) {
        return
      }
      try {
        await transport.send(state.activeSessionId, intent)
      } catch (error) {
        publishOutcome({ type: "send-failed" })
        await machine.disconnect().catch(() => undefined)
        throw error
      }
    },
    receiveCommand: (command) => receiveCommand(command),
    setRealtimeStatus: (realtimeStatus) => {
      if (state.realtimeStatus !== realtimeStatus) {
        publish({ ...state, realtimeStatus })
      }
    },
    receiveRealtime: (event, userSessionId) => {
      if (event.kind === "command" && event.targetSessionId === userSessionId) {
        const command = parseRemoteCommandWirePayload(event)
        if (command) {
          receiveCommand(command)
        } else {
          publishOutcome({ type: "invalid-command" })
        }
      } else if (event.kind === "connections" && event.controllingDevices) {
        syncDevices(event.controllingDevices)
      } else if (event.kind === "targets") {
        disconnectMissingTarget(event.activeTargets)
      }
    },
    poll: async () => {
      await delivery.retryPendingAcknowledgements()
      const data = await transport.poll()
      if (data.controllingDevices !== undefined) {
        syncDevices(data.controllingDevices)
      } else if (data.controlledBy) {
        syncDevices([
          {
            id: data.controlledBy,
            name: data.controllerName || "Unnamed device",
          },
        ])
      } else if (data.controlledBy === null) {
        syncDevices([])
      }
      disconnectMissingTarget(data.activeTargets)
      for (const command of data.commands ?? []) {
        const parsedCommand = parseRemoteCommandWirePayload(command)
        if (parsedCommand && receiveCommand(parsedCommand)) {
          break
        } else if (!parsedCommand) {
          publishOutcome({ type: "invalid-command" })
        }
      }
    },
    acknowledgeCommand: async (commandId) => {
      const acknowledgement = delivery.acknowledge(commandId)
      syncDeliveryState()
      await acknowledgement
    },
    markCommandApplied: (commandId) => {
      delivery.markApplied(commandId)
      syncDeliveryState()
    },
    failCommand: async (commandId, message) => {
      await transport.reportResult(commandId, "failed", message)
      delivery.markFailed(commandId)
      syncDeliveryState()
    },
    start: (shouldPoll: () => boolean = () => true) => {
      const poll = () => {
        if (!shouldPoll()) {
          return
        }
        return machine
          .poll()
          .catch(() => publishOutcome({ type: "delivery-unavailable" }))
      }
      void poll()
      const intervalId = clock.setInterval(() => {
        void poll()
      }, REMOTE_POLL_INTERVAL_MS)
      return () => clock.clearInterval(intervalId)
    },
  }
  return machine
}
