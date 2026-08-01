import { REMOTE_DEVICE_NAME_KEY, REMOTE_SESSION_ID_KEY } from "./constants"

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
}
