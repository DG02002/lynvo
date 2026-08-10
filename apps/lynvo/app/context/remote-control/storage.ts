import {
  REMOTE_COMMAND_DELIVERY_KEY,
  REMOTE_DEVICE_NAME_KEY,
  REMOTE_SESSION_ID_KEY,
} from "./constants"

const EMPTY_DELIVERY_RECORD: RemoteCommandDeliveryRecord = {
  processed: [],
  applied: [],
  pendingAcknowledgements: [],
}

export const createRemoteControlPersistence = (
  identity = "signed-out"
): RemoteControlPersistence => {
  const sessionIdKey = `${REMOTE_SESSION_ID_KEY}:${identity}`
  const deviceNameKey = `${REMOTE_DEVICE_NAME_KEY}:${identity}`
  const deliveryKey = `${REMOTE_COMMAND_DELIVERY_KEY}:${identity}`
  return {
    load: () => {
      if (typeof window === "undefined") {
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
      if (typeof window === "undefined") {
        return EMPTY_DELIVERY_RECORD
      }
      try {
        const stored = localStorage.getItem(deliveryKey)
        if (!stored) {
          return EMPTY_DELIVERY_RECORD
        }
        const parsed: unknown = JSON.parse(stored)
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          !("processed" in parsed) ||
          !("applied" in parsed) ||
          !("pendingAcknowledgements" in parsed) ||
          !Array.isArray(parsed.processed) ||
          !Array.isArray(parsed.applied) ||
          !Array.isArray(parsed.pendingAcknowledgements)
        ) {
          return EMPTY_DELIVERY_RECORD
        }
        return {
          processed: parsed.processed.filter(
            (entry): entry is [string, number] =>
              Array.isArray(entry) &&
              typeof entry[0] === "string" &&
              typeof entry[1] === "number"
          ),
          applied: parsed.applied.filter(
            (entry): entry is [string, number] =>
              Array.isArray(entry) &&
              typeof entry[0] === "string" &&
              typeof entry[1] === "number"
          ),
          pendingAcknowledgements: parsed.pendingAcknowledgements.filter(
            (commandId): commandId is string => typeof commandId === "string"
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

export const remoteControlPersistence = createRemoteControlPersistence()
