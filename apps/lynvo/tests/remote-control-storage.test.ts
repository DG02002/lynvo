import { beforeEach, describe, expect, it } from "vitest"
import {
  REMOTE_DEVICE_NAME_KEY,
  REMOTE_COMMAND_DELIVERY_KEY,
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

  it("persists command delivery recovery state", () => {
    const record: RemoteCommandDeliveryRecord = {
      processed: [],
      applied: [["command-1", 100]],
      pendingAcknowledgements: ["command-1"],
    }

    remoteControlPersistence.saveDelivery(record)

    expect(localStorage.getItem(REMOTE_COMMAND_DELIVERY_KEY)).not.toBeNull()
    expect(remoteControlPersistence.loadDelivery()).toEqual(record)
  })

  it("loads the current Lynvo storage keys", () => {
    localStorage.setItem(REMOTE_SESSION_ID_KEY, "session-1")
    localStorage.setItem(REMOTE_DEVICE_NAME_KEY, "Living room")

    expect(remoteControlPersistence.load()).toEqual({
      sessionId: "session-1",
      deviceName: "Living room",
    })
  })
})
