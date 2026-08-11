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
  entries: unknown[]
): Array<[string, number]> => {
  const normalizedEntries = new Map<string, number>()
  for (const entry of entries) {
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== "string" ||
      typeof entry[1] !== "number"
    ) {
      continue
    }
    const { commandId } = parseCommandIdentity(entry[0])
    const existingTimestamp = normalizedEntries.get(commandId)
    if (existingTimestamp === undefined || entry[1] > existingTimestamp) {
      normalizedEntries.set(commandId, entry[1])
    }
  }
  return [...normalizedEntries]
}

const normalizePendingAcknowledgements = (
  entries: unknown[]
): Array<[string, string]> => {
  const normalizedEntries = new Map<string, string>()
  for (const entry of entries) {
    if (
      Array.isArray(entry) &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "string"
    ) {
      normalizedEntries.set(entry[0], entry[1])
      continue
    }
    if (typeof entry === "string") {
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
          processed: normalizeTimedCommandEntries(parsed.processed),
          applied: normalizeTimedCommandEntries(parsed.applied),
          pendingAcknowledgements: normalizePendingAcknowledgements(
            parsed.pendingAcknowledgements
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
