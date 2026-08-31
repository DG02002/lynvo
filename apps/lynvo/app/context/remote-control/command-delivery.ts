import { Result, Schema } from "effect"
import {
  REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS,
  REMOTE_COMMAND_STALE_AFTER_MS,
} from "./constants"
import { remoteCommandFieldsSchema } from "~/lib/remote-play/wire"
import { parseRemotePlaybackIntent } from "~/features/links/playable-link-handoff"

declare global {
  interface RemoteCommandDeliveryInput {
    id: string
    claimToken: string
    command: "play"
    payload: RemotePlaybackIntent
    createdAt: number
  }

  interface RemoteCommand {
    id: string
    claimToken: string
    command: "play"
    payload: RemotePlaybackIntent
    receivedAt: number
  }

  interface RemoteCommandDeliveryState {
    lastCommand: RemoteCommand | null
  }

  interface RemoteCommandDeliveryDependencies {
    reportApplied: (commandId: string, claimToken: string) => Promise<void>
    now: () => number
    persistence: Pick<RemoteControlPersistence, "loadDelivery" | "saveDelivery">
  }

  interface RemoteCommandDeliveryRecord {
    processed: ReadonlyArray<readonly [string, number]>
    applied: ReadonlyArray<readonly [string, number]>
    pendingAcknowledgements: ReadonlyArray<readonly [string, string]>
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

export const parseRemoteCommandWirePayload = <Value>(
  value: Value
): RemoteCommandDeliveryInput | undefined => {
  const parsed = Schema.decodeUnknownResult(remoteCommandFieldsSchema)(value)
  if (Result.isFailure(parsed)) {
    return undefined
  }
  let jsonPayload: unknown
  try {
    jsonPayload = JSON.parse(parsed.success.payload)
  } catch {
    return undefined
  }
  const payload = parseRemotePlaybackIntent(jsonPayload)
  if (Result.isFailure(payload)) {
    return undefined
  }
  return {
    ...parsed.success,
    payload: payload.success,
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
  const pendingAcknowledgements = new Map(storedRecord.pendingAcknowledgements)
  const pendingRecordedAt = new Map<string, number>()
  for (const commandId of pendingAcknowledgements.keys()) {
    pendingRecordedAt.set(commandId, now())
  }
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
    // Acknowledgements whose command has aged out of the server's TTL would
    // 404 forever; retire them with the same window.
    for (const [commandId, recordedAt] of pendingRecordedAt) {
      if (currentTime - recordedAt > REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS) {
        pendingAcknowledgements.delete(commandId)
        pendingRecordedAt.delete(commandId)
      }
    }
    persist()
  }

  const retryAcknowledgement = (commandId: string) => {
    const activeRequest = acknowledgementRequests.get(commandId)
    if (activeRequest) {
      return activeRequest
    }
    const claimToken = pendingAcknowledgements.get(commandId)
    if (!claimToken) {
      return Promise.resolve()
    }
    const request = reportApplied(commandId, claimToken)
      .then(() => {
        pendingAcknowledgements.delete(commandId)
        appliedCommands.delete(commandId)
        processedCommands.set(commandId, now())
        persist()
      })
      .catch(() => {
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
      if (processedCommands.has(command.id) || state.lastCommand !== null) {
        return false
      }
      if (appliedCommands.has(command.id)) {
        pendingAcknowledgements.set(command.id, command.claimToken)
        pendingRecordedAt.set(command.id, now())
        persist()
        return false
      }
      state = {
        lastCommand: {
          id: command.id,
          claimToken: command.claimToken,
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
      pendingAcknowledgements.set(commandId, state.lastCommand.claimToken)
      pendingRecordedAt.set(commandId, now())
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
      await Promise.all(
        [...pendingAcknowledgements.keys()].map(retryAcknowledgement)
      )
    },
  }
}
