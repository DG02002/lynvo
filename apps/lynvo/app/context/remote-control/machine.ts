import {
  createRemoteCommandDelivery,
  parseRemoteCommandWirePayload,
} from "./command-delivery"
import {
  REMOTE_POLL_FAILURE_NOTICE_AFTER_MS,
  REMOTE_POLL_INTERVAL_MS,
} from "./constants"

const REMOTE_POLL_BASE_BACKOFF_MS = 1_000
const REMOTE_POLL_MAX_BACKOFF_MS = 30_000
const ALWAYS_POLL = () => true
const NEVER_POLL = () => false

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
    controllingDevices: readonly RemoteDevice[]
    lastCommand: RemoteCommand | null
  }

  interface RemotePollResponse {
    readonly controlledBy?: string | null
    readonly controllerName?: string | null
    readonly controllingDevices?: readonly RemoteDevice[]
    readonly activeTargets?: readonly string[]
    readonly commands?: readonly RemoteCommandWireFields[]
  }

  interface RemoteRealtimeEvent {
    kind?: string
    id?: string
    command?: string
    payload?: unknown
    createdAt?: number
    controllingDevices?: readonly RemoteDevice[]
    activeTargets?: readonly string[]
    targetSessionId?: string
  }

  interface RemoteCommandResultReport {
    commandId: string
    claimToken: string
    result: "applied" | "failed"
    message?: string
  }

  interface RemoteControlTransport {
    send: (
      targetSessionId: string,
      intent: RemotePlaybackIntent
    ) => Promise<void>
    poll: () => Promise<RemotePollResponse>
    reportResult: (report: RemoteCommandResultReport) => Promise<void>
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
    setTimeout: (callback: () => void, delayMs: number) => number
    clearTimeout: (timeoutId: number) => void
    setInterval: (callback: () => void, intervalMs: number) => number
    clearInterval: (intervalId: number) => void
  }

  type RemoteControlOutcome =
    | { type: "connected"; deviceName: string }
    | { type: "disconnected" }
    | { type: "receiver-disconnected" }
    | { type: "send-failed"; error: unknown }
    | { type: "receiver-connected"; deviceName: string }
    | { type: "receiver-ended" }
    | { type: "command-received"; command: "play" }
    | { type: "invalid-command" }
    | { type: "delivery-unavailable" }

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
}

const haveSameDevices = (
  currentDevices: readonly RemoteDevice[],
  nextDevices: readonly RemoteDevice[]
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

const createRemotePollController = ({
  clock,
  pollOnce,
  onSustainedFailure,
}: {
  clock: RemoteControlClock
  pollOnce: () => Promise<void>
  onSustainedFailure: () => void
}) => {
  let request: Promise<void> | undefined
  let retryTimer: number | undefined
  let failureCount = 0
  let failureStartedAt: number | undefined
  let didReportFailure = false
  let generation = 0
  let isActive = false
  let shouldPoll = ALWAYS_POLL

  const clearRetry = () => {
    if (retryTimer !== undefined) {
      clock.clearTimeout(retryTimer)
      retryTimer = undefined
    }
  }

  const scheduleRetry = () => {
    if (!isActive || retryTimer !== undefined) {
      return
    }
    const retryGeneration = generation
    const baseDelay = Math.min(
      REMOTE_POLL_MAX_BACKOFF_MS,
      REMOTE_POLL_BASE_BACKOFF_MS * 2 ** Math.min(failureCount - 1, 5)
    )
    const delay = Math.round(baseDelay * (0.75 + Math.random() * 0.5))
    retryTimer = clock.setTimeout(() => {
      retryTimer = undefined
      if (retryGeneration === generation && isActive && shouldPoll()) {
        void poll()
      }
    }, delay)
  }

  const recordFailure = () => {
    failureCount += 1
    failureStartedAt ??= clock.now()
    if (
      !didReportFailure &&
      clock.now() - failureStartedAt >= REMOTE_POLL_FAILURE_NOTICE_AFTER_MS
    ) {
      didReportFailure = true
      onSustainedFailure()
    }
    scheduleRetry()
  }

  const poll = async (): Promise<void> => {
    if (request || retryTimer !== undefined) {
      return request
    }
    const currentRequest = (async () => {
      try {
        await pollOnce()
        failureCount = 0
        failureStartedAt = undefined
        didReportFailure = false
      } catch (error) {
        console.error("Remote Play poll failed; retrying with backoff", error)
        recordFailure()
      }
    })()
    request = currentRequest
    try {
      await currentRequest
    } finally {
      if (request === currentRequest) {
        request = undefined
      }
    }
  }

  const start = (shouldPollWhenActive: () => boolean = ALWAYS_POLL) => {
    const currentGeneration = ++generation
    isActive = true
    shouldPoll = shouldPollWhenActive
    const attemptPoll = () => {
      if (shouldPoll()) {
        void poll()
      }
    }
    attemptPoll()
    const intervalId = clock.setInterval(attemptPoll, REMOTE_POLL_INTERVAL_MS)
    return () => {
      clock.clearInterval(intervalId)
      if (currentGeneration === generation) {
        isActive = false
        shouldPoll = NEVER_POLL
        clearRetry()
      }
    }
  }

  return { poll, start }
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
    reportApplied: async (commandId, claimToken) => {
      await transport.reportResult({
        commandId,
        claimToken,
        result: "applied",
      })
    },
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
    const { lastCommand } = delivery.getSnapshot()
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

  const syncDevices = (nextDevices: readonly RemoteDevice[]) => {
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

  const disconnectMissingTarget = (activeTargets?: readonly string[]) => {
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

  const handlePollResponse = (data: RemotePollResponse) => {
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
  }

  const pollController = createRemotePollController({
    clock,
    pollOnce: async () => {
      await delivery.retryPendingAcknowledgements()
      handlePollResponse(await transport.poll())
    },
    onSustainedFailure: () => publishOutcome({ type: "delivery-unavailable" }),
  })

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
      if (state.activeSessionId === sessionId) {
        return
      }
      persistence.save(sessionId, deviceName)
      publish({
        ...state,
        activeSessionId: sessionId,
        connectedDeviceName: deviceName,
      })
      publishOutcome({ type: "connected", deviceName })
    },
    disconnect: async () => {
      if (!state.activeSessionId) {
        return
      }
      persistence.clear()
      publish({
        ...state,
        activeSessionId: null,
        connectedDeviceName: null,
      })
      publishOutcome({ type: "disconnected" })
    },
    disconnectReceiver: async () => {
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
        publishOutcome({
          type: "send-failed",
          error,
        })
        await machine.disconnect().catch(() => undefined)
        throw error
      }
    },
    receiveCommand: (command) => receiveCommand(command),
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
    poll: pollController.poll,
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
      const command = delivery.getSnapshot().lastCommand
      if (!command || command.id !== commandId) {
        return
      }
      await transport.reportResult({
        commandId,
        claimToken: command.claimToken,
        result: "failed",
        message,
      })
      delivery.markFailed(commandId)
      syncDeliveryState()
    },
    start: pollController.start,
  }
  return machine
}
