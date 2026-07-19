import {
  REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS,
  REMOTE_COMMAND_STALE_AFTER_MS,
  REMOTE_POLL_INTERVAL_MS,
} from "./constants"

declare global {
  interface RemoteDevice {
    id: string
    name: string
  }

  interface RemoteCommand {
    id: string
    command: string
    payload: unknown
    receivedAt: number
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
    commands?: Array<{
      id?: string
      command: string
      payload: string | unknown | null
      createdAt?: number
    }>
    controlledBy?: string | null
    controllerName?: string | null
    controllingDevices?: RemoteDevice[]
    activeTargets?: string[]
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
      command: string,
      payload?: unknown
    ) => Promise<unknown>
    poll: () => Promise<RemotePollResponse>
  }

  interface RemoteControlPersistence {
    load: () => {
      sessionId: string | null
      deviceName: string | null
    }
    save: (sessionId: string, deviceName: string) => void
    clear: () => void
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
    deviceName?: string
    command?: string
  }

  interface RemoteControlMachine {
    getSnapshot: () => RemoteControlMachineState
    subscribe: (listener: () => void) => () => void
    subscribeOutcomes: (
      listener: (outcome: RemoteControlOutcome) => void
    ) => () => void
    connect: (sessionId: string, deviceName: string) => Promise<void>
    disconnect: () => Promise<void>
    disconnectReceiver: () => Promise<void>
    send: (command: string, payload?: unknown) => Promise<void>
    setRealtimeStatus: (status: string) => void
    receiveRealtime: (
      event: RemoteRealtimeEvent,
      userSessionId?: string
    ) => void
    poll: () => Promise<void>
    acknowledgeCommand: (commandId: string) => void
    start: () => () => void
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

const parsePayload = (payload: string | unknown | null) => {
  if (typeof payload !== "string") {
    return payload ?? null
  }
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

const commandFingerprint = (
  command: string,
  payload: unknown,
  createdAt?: number,
  id?: string
) => id ?? `${command}:${JSON.stringify(payload)}:${createdAt ?? "legacy"}`

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
  const processedCommands = new Map<string, number>()

  const publish = (nextState: RemoteControlMachineState) => {
    state = nextState
    listeners.forEach((listener) => listener())
  }
  const publishOutcome = (outcome: RemoteControlOutcome) =>
    outcomeListeners.forEach((listener) => listener(outcome))

  const receiveCommand = (
    command: string,
    payload: unknown,
    createdAt?: number,
    id?: string
  ) => {
    const now = clock.now()
    if (
      createdAt !== undefined &&
      now - createdAt > REMOTE_COMMAND_STALE_AFTER_MS
    ) {
      return
    }
    for (const [processedId, processedAt] of processedCommands) {
      if (now - processedAt > REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS) {
        processedCommands.delete(processedId)
      }
    }
    const commandId = commandFingerprint(command, payload, createdAt, id)
    if (
      processedCommands.has(commandId) ||
      state.lastCommand?.id === commandId
    ) {
      return
    }
    publish({
      ...state,
      lastCommand: { id: commandId, command, payload, receivedAt: now },
    })
    publishOutcome({ type: "command-received", command })
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
    send: async (command, payload) => {
      if (!state.activeSessionId) {
        return
      }
      try {
        await transport.send(state.activeSessionId, command, payload)
      } catch (error) {
        publishOutcome({ type: "send-failed" })
        await machine.disconnect().catch(() => undefined)
        throw error
      }
    },
    setRealtimeStatus: (realtimeStatus) => {
      if (state.realtimeStatus !== realtimeStatus) {
        publish({ ...state, realtimeStatus })
      }
    },
    receiveRealtime: (event, userSessionId) => {
      if (
        event.kind === "command" &&
        event.command &&
        event.targetSessionId === userSessionId
      ) {
        receiveCommand(
          event.command,
          event.payload ?? null,
          event.createdAt,
          event.id
        )
      } else if (event.kind === "connections" && event.controllingDevices) {
        syncDevices(event.controllingDevices)
      } else if (event.kind === "targets") {
        disconnectMissingTarget(event.activeTargets)
      }
    },
    poll: async () => {
      const data = await transport.poll()
      if (data.controllingDevices !== undefined) {
        syncDevices(data.controllingDevices)
      } else if (data.controlledBy) {
        syncDevices([
          {
            id: data.controlledBy,
            name: data.controllerName || "Unknown Device",
          },
        ])
      } else if (data.controlledBy === null) {
        syncDevices([])
      }
      disconnectMissingTarget(data.activeTargets)
      for (const command of data.commands ?? []) {
        receiveCommand(
          command.command,
          parsePayload(command.payload),
          command.createdAt,
          command.id
        )
      }
    },
    acknowledgeCommand: (commandId) => {
      if (state.lastCommand?.id !== commandId) {
        return
      }
      processedCommands.set(commandId, clock.now())
      publish({ ...state, lastCommand: null })
    },
    start: () => {
      const intervalId = clock.setInterval(() => {
        const isActive = Boolean(
          state.activeSessionId ||
          state.controlledBy ||
          state.controllingDevices.length > 0
        )
        if (state.realtimeStatus !== "connected" && isActive) {
          void machine.poll().catch(() => undefined)
        }
      }, REMOTE_POLL_INTERVAL_MS)
      return () => clock.clearInterval(intervalId)
    },
  }
  return machine
}
