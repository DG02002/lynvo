import { beforeEach, describe, expect, it } from "vitest"
import {
  REMOTE_DEVICE_NAME_KEY,
  REMOTE_SESSION_ID_KEY,
} from "~/context/remote-control/constants"
import { remoteControlPersistence } from "~/context/remote-control/storage"

const createMemoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size
    },
  } satisfies Storage
}

describe("remote-control browser persistence", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    })
    localStorage.clear()
  })

  it("loads the current Lynvo storage keys", () => {
    localStorage.setItem(REMOTE_SESSION_ID_KEY, "session-1")
    localStorage.setItem(REMOTE_DEVICE_NAME_KEY, "Living room")

    expect(remoteControlPersistence.load()).toEqual({
      sessionId: "session-1",
      deviceName: "Living room",
    })
  })

  it("does not migrate storage keys from the previous product name", () => {
    localStorage.setItem("playlink_remote_session_id", "old-session")
    localStorage.setItem("playlink_remote_device_name", "Old device")

    expect(remoteControlPersistence.load()).toEqual({
      sessionId: null,
      deviceName: null,
    })
    expect(localStorage.getItem(REMOTE_SESSION_ID_KEY)).toBeNull()
    expect(localStorage.getItem(REMOTE_DEVICE_NAME_KEY)).toBeNull()
  })
})
