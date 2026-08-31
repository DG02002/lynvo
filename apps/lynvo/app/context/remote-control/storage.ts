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
const pendingAcknowledgementSchema = Schema.Tuple([
  Schema.String,
  Schema.String,
])
const deliveryRecordSchema = Schema.Struct({
  processed: Schema.Array(timedCommandEntrySchema),
  applied: Schema.Array(timedCommandEntrySchema),
  pendingAcknowledgements: Schema.Array(pendingAcknowledgementSchema),
})

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
        return parsed.success
      } catch {
        return EMPTY_DELIVERY_RECORD
      }
    },
    saveDelivery: (record) => {
      localStorage.setItem(deliveryKey, JSON.stringify(record))
    },
  }
}
