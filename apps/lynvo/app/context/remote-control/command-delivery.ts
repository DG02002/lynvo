import {
  REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS,
  REMOTE_COMMAND_STALE_AFTER_MS,
} from "./constants"
import { remoteCommandFieldsSchema } from "~/lib/remote-play/wire"
import { parseRemotePlaybackIntent } from "~/features/links/playable-link-handoff"

declare global {
  interface RemoteCommandDeliveryInput {
    id: string
    command: "play"
    payload: RemotePlaybackIntent
    createdAt: number
  }

  interface RemoteCommand {
    id: string
    command: "play"
    payload: RemotePlaybackIntent
    receivedAt: number
  }

  interface RemoteCommandDeliveryState {
    lastCommand: RemoteCommand | null
  }

  interface RemoteCommandDeliveryDependencies {
    reportApplied: (commandId: string) => Promise<unknown>
    now: () => number
    persistence: Pick<RemoteControlPersistence, "loadDelivery" | "saveDelivery">
  }

  interface RemoteCommandDeliveryRecord {
    processed: Array<[string, number]>
    applied: Array<[string, number]>
    pendingAcknowledgements: string[]
  }

  interface RemoteCommandDelivery {
    getSnapshot: () => RemoteCommandDeliveryState
    receive: (command: RemoteCommandDeliveryInput) => boolean
    markApplied: (commandId: string) => void
    markFailed: (commandId: string) => void
    acknowledge: (commandId: string) => Promise<void>
    retryPendingAcknowledgements: () => Promise<void>
  }
}

export const parseRemoteCommandWirePayload = (
  value: unknown
): RemoteCommandDeliveryInput | undefined => {
  const parsed = remoteCommandFieldsSchema.safeParse(value)
  if (!parsed.success) {
    return undefined
  }
  const payload = parseRemotePlaybackIntent(JSON.parse(parsed.data.payload))
  if (!payload.success) {
    return undefined
  }
  return {
    ...parsed.data,
    payload: payload.data,
  }
}

export const createRemoteCommandDelivery = ({
  reportApplied,
  now,
  persistence,
}: RemoteCommandDeliveryDependencies): RemoteCommandDelivery => {
  let state: RemoteCommandDeliveryState = { lastCommand: null }
  const storedRecord = persistence.loadDelivery()
  const processedCommands = new Map(storedRecord.processed)
  const appliedCommands = new Map(storedRecord.applied)
  const pendingAcknowledgements = new Set(storedRecord.pendingAcknowledgements)
  const acknowledgementRequests = new Map<string, Promise<void>>()

  const persist = () =>
    persistence.saveDelivery({
      processed: [...processedCommands],
      applied: [...appliedCommands],
      pendingAcknowledgements: [...pendingAcknowledgements],
    })

  const expireRecordedCommandIds = (currentTime: number) => {
    for (const commandIds of [processedCommands, appliedCommands]) {
      for (const [commandId, recordedAt] of commandIds) {
        if (currentTime - recordedAt > REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS) {
          commandIds.delete(commandId)
        }
      }
    }
    persist()
  }

  const retryAcknowledgement = (commandId: string) => {
    const activeRequest = acknowledgementRequests.get(commandId)
    if (activeRequest) {
      return activeRequest
    }
    const request = reportApplied(commandId)
      .then(() => {
        pendingAcknowledgements.delete(commandId)
        appliedCommands.delete(commandId)
        processedCommands.set(commandId, now())
        persist()
      })
      .catch(() => {
        pendingAcknowledgements.add(commandId)
        persist()
      })
      .finally(() => {
        acknowledgementRequests.delete(commandId)
      })
    acknowledgementRequests.set(commandId, request)
    return request
  }

  return {
    getSnapshot: () => state,
    receive: (command) => {
      const currentTime = now()
      if (
        !command.id ||
        currentTime - command.createdAt > REMOTE_COMMAND_STALE_AFTER_MS
      ) {
        return false
      }
      expireRecordedCommandIds(currentTime)
      if (
        processedCommands.has(command.id) ||
        appliedCommands.has(command.id) ||
        state.lastCommand !== null
      ) {
        return false
      }
      state = {
        lastCommand: {
          id: command.id,
          command: command.command,
          payload: command.payload,
          receivedAt: currentTime,
        },
      }
      return true
    },
    markApplied: (commandId) => {
      if (state.lastCommand?.id !== commandId) {
        return
      }
      appliedCommands.set(commandId, now())
      pendingAcknowledgements.add(commandId)
      state = { lastCommand: null }
      persist()
    },
    markFailed: (commandId) => {
      if (state.lastCommand?.id !== commandId) {
        return
      }
      processedCommands.set(commandId, now())
      state = { lastCommand: null }
      persist()
    },
    acknowledge: async (commandId) => {
      if (!pendingAcknowledgements.has(commandId)) {
        return
      }
      await retryAcknowledgement(commandId)
    },
    retryPendingAcknowledgements: async () => {
      await Promise.all([...pendingAcknowledgements].map(retryAcknowledgement))
    },
  }
}
