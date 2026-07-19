import {
  LEGACY_REMOTE_DEVICE_NAME_KEY,
  LEGACY_REMOTE_SESSION_ID_KEY,
  REMOTE_DEVICE_NAME_KEY,
  REMOTE_SESSION_ID_KEY,
} from "./constants"

const migrateStoredValue = (currentKey: string, legacyKey: string) => {
  const currentValue = localStorage.getItem(currentKey)
  if (currentValue) {
    return currentValue
  }
  const legacyValue = localStorage.getItem(legacyKey)
  if (legacyValue) {
    localStorage.setItem(currentKey, legacyValue)
  }
  return legacyValue
}

export const remoteControlPersistence: RemoteControlPersistence = {
  load: () => {
    if (typeof window === "undefined") {
      return { sessionId: null, deviceName: null }
    }
    const sessionId = migrateStoredValue(
      REMOTE_SESSION_ID_KEY,
      LEGACY_REMOTE_SESSION_ID_KEY
    )
    const deviceName = migrateStoredValue(
      REMOTE_DEVICE_NAME_KEY,
      LEGACY_REMOTE_DEVICE_NAME_KEY
    )
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
}
