import {
  REMOTE_COMMAND_DELIVERY_KEY,
  REMOTE_DEVICE_NAME_KEY,
  REMOTE_SESSION_ID_KEY,
} from "./constants"
import { Result, Schema } from "effect"

const EMPTY_DELIVERY_RECORD: RemoteCommandDeliveryRecord = {
  processed: [],
  applied: [],
  pendingAcknowledgements: [],
}

const timedCommandEntrySchema = Schema.Tuple([Schema.String, Schema.Number])
const pendingAcknowledgementSchema = Schema.Union([
  Schema.Tuple([Schema.String, Schema.String]),
  Schema.String,
])
const deliveryRecordSchema = Schema.Struct({
  processed: Schema.Array(timedCommandEntrySchema),
  applied: Schema.Array(timedCommandEntrySchema),
  pendingAcknowledgements: Schema.Array(pendingAcknowledgementSchema),
})

const parseCommandIdentity = (
  identity: string
): { commandId: string; claimToken?: string } => {
  const separatorIndex = identity.indexOf(":")
  return separatorIndex > 0 && separatorIndex < identity.length - 1
    ? {
        commandId: identity.slice(0, separatorIndex),
        claimToken: identity.slice(separatorIndex + 1),
      }
    : { commandId: identity }
}

const normalizeTimedCommandEntries = (
  entries: readonly (typeof timedCommandEntrySchema.Type)[]
): Array<[string, number]> => {
  const normalizedEntries = new Map<string, number>()
  for (const entry of entries) {
    const { commandId } = parseCommandIdentity(entry[0])
    const existingTimestamp = normalizedEntries.get(commandId)
    if (existingTimestamp === undefined || entry[1] > existingTimestamp) {
      normalizedEntries.set(commandId, entry[1])
    }
  }
  return [...normalizedEntries]
}

const isTupleEntry = (
  entry: typeof pendingAcknowledgementSchema.Type
): entry is readonly [string, string] => Array.isArray(entry)

const normalizePendingAcknowledgements = (
  entries: readonly (typeof pendingAcknowledgementSchema.Type)[]
): Array<[string, string]> => {
  const normalizedEntries = new Map<string, string>()
  for (const entry of entries) {
    if (isTupleEntry(entry)) {
      normalizedEntries.set(entry[0], entry[1])
    } else {
      const { commandId, claimToken } = parseCommandIdentity(entry)
      if (claimToken) {
        normalizedEntries.set(commandId, claimToken)
      }
    }
  }
  return [...normalizedEntries]
}

export const createRemoteControlPersistence = (
  identity = "signed-out"
): RemoteControlPersistence => {
  const sessionIdKey = `${REMOTE_SESSION_ID_KEY}:${identity}`
  const deviceNameKey = `${REMOTE_DEVICE_NAME_KEY}:${identity}`
  const deliveryKey = `${REMOTE_COMMAND_DELIVERY_KEY}:${identity}`
  return {
    load: () => {
      if (globalThis.window === undefined) {
        return { sessionId: null, deviceName: null }
      }
      const sessionId = localStorage.getItem(sessionIdKey)
      const deviceName = localStorage.getItem(deviceNameKey)
      if (!sessionId || !deviceName) {
        localStorage.removeItem(sessionIdKey)
        localStorage.removeItem(deviceNameKey)
        return { sessionId: null, deviceName: null }
      }
      return { sessionId, deviceName }
    },
    save: (sessionId, deviceName) => {
      localStorage.setItem(sessionIdKey, sessionId)
      localStorage.setItem(deviceNameKey, deviceName)
    },
    clear: () => {
      localStorage.removeItem(sessionIdKey)
      localStorage.removeItem(deviceNameKey)
    },
    loadDelivery: () => {
      if (globalThis.window === undefined) {
        return EMPTY_DELIVERY_RECORD
      }
      try {
        const stored = localStorage.getItem(deliveryKey)
        if (!stored) {
          return EMPTY_DELIVERY_RECORD
        }
        const parsed = Schema.decodeUnknownResult(deliveryRecordSchema)(
          JSON.parse(stored)
        )
        if (Result.isFailure(parsed)) {
          return EMPTY_DELIVERY_RECORD
        }
        return {
          processed: normalizeTimedCommandEntries(parsed.success.processed),
          applied: normalizeTimedCommandEntries(parsed.success.applied),
          pendingAcknowledgements: normalizePendingAcknowledgements(
            parsed.success.pendingAcknowledgements
          ),
        }
      } catch {
        return EMPTY_DELIVERY_RECORD
      }
    },
    saveDelivery: (record) => {
      localStorage.setItem(deliveryKey, JSON.stringify(record))
    },
  }
}
