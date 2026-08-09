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

export const remoteControlPersistence: RemoteControlPersistence = {
  load: () => {
    if (typeof window === "undefined") {
      return { sessionId: null, deviceName: null }
    }
    const sessionId = localStorage.getItem(REMOTE_SESSION_ID_KEY)
    const deviceName = localStorage.getItem(REMOTE_DEVICE_NAME_KEY)
    if (!sessionId || !deviceName) {
      localStorage.removeItem(REMOTE_SESSION_ID_KEY)
      localStorage.removeItem(REMOTE_DEVICE_NAME_KEY)
      return { sessionId: null, deviceName: null }
    }
    return { sessionId, deviceName }
  },
  save: (sessionId, deviceName) => {
    localStorage.setItem(REMOTE_SESSION_ID_KEY, sessionId)
    localStorage.setItem(REMOTE_DEVICE_NAME_KEY, deviceName)
  },
  clear: () => {
    localStorage.removeItem(REMOTE_SESSION_ID_KEY)
    localStorage.removeItem(REMOTE_DEVICE_NAME_KEY)
  },
  loadDelivery: () => {
    if (typeof window === "undefined") {
      return EMPTY_DELIVERY_RECORD
    }
    try {
      const stored = localStorage.getItem(REMOTE_COMMAND_DELIVERY_KEY)
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
    localStorage.setItem(REMOTE_COMMAND_DELIVERY_KEY, JSON.stringify(record))
  },
}
