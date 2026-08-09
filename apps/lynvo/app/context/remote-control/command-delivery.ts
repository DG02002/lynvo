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
    acknowledge: (commandId: string) => Promise<unknown>
    now: () => number
  }

  interface RemoteCommandDelivery {
    getSnapshot: () => RemoteCommandDeliveryState
    receive: (command: RemoteCommandDeliveryInput) => boolean
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
  acknowledge,
  now,
}: RemoteCommandDeliveryDependencies): RemoteCommandDelivery => {
  let state: RemoteCommandDeliveryState = { lastCommand: null }
  const processedCommands = new Map<string, number>()
  const appliedCommands = new Map<string, number>()
  const pendingAcknowledgements = new Set<string>()
  const acknowledgementRequests = new Map<string, Promise<void>>()

  const expireRecordedCommandIds = (currentTime: number) => {
    for (const commandIds of [processedCommands, appliedCommands]) {
      for (const [commandId, recordedAt] of commandIds) {
        if (currentTime - recordedAt > REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS) {
          commandIds.delete(commandId)
        }
      }
    }
  }

  const retryAcknowledgement = (commandId: string) => {
    const activeRequest = acknowledgementRequests.get(commandId)
    if (activeRequest) {
      return activeRequest
    }
    const request = acknowledge(commandId)
      .then(() => {
        pendingAcknowledgements.delete(commandId)
        appliedCommands.delete(commandId)
        processedCommands.set(commandId, now())
      })
      .catch(() => {
        pendingAcknowledgements.add(commandId)
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
    acknowledge: async (commandId) => {
      if (state.lastCommand?.id !== commandId) {
        return
      }
      appliedCommands.set(commandId, now())
      pendingAcknowledgements.add(commandId)
      state = { lastCommand: null }
      await retryAcknowledgement(commandId)
    },
    retryPendingAcknowledgements: async () => {
      await Promise.all([...pendingAcknowledgements].map(retryAcknowledgement))
    },
  }
}
