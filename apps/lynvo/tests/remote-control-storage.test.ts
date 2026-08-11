import { beforeEach, describe, expect, it } from "vitest"
import {
  REMOTE_DEVICE_NAME_KEY,
  REMOTE_COMMAND_DELIVERY_KEY,
  REMOTE_SESSION_ID_KEY,
} from "~/context/remote-control/constants"
import { createRemoteControlPersistence } from "~/context/remote-control/storage"

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
    const remoteControlPersistence = createRemoteControlPersistence(
      "account-one:session-one"
    )
    const record: RemoteCommandDeliveryRecord = {
      processed: [],
      applied: [["command-1", 100]],
      pendingAcknowledgements: [["command-1", "claim-1"]],
    }

    remoteControlPersistence.saveDelivery(record)

    expect(
      localStorage.getItem(
        `${REMOTE_COMMAND_DELIVERY_KEY}:account-one:session-one`
      )
    ).not.toBeNull()
    expect(remoteControlPersistence.loadDelivery()).toEqual(record)
  })

  it("migrates composite acknowledgement identities", () => {
    const persistence = createRemoteControlPersistence("migration")
    localStorage.setItem(
      `${REMOTE_COMMAND_DELIVERY_KEY}:migration`,
      JSON.stringify({
        processed: [
          ["command-2:claim-1", 50],
          ["command-2:claim-2", 75],
        ],
        applied: [
          ["command-1:claim-1", 100],
          ["command-1:claim-2", 90],
        ],
        pendingAcknowledgements: ["command-1:claim-1"],
      })
    )
    expect(persistence.loadDelivery()).toEqual({
      processed: [["command-2", 75]],
      applied: [["command-1", 100]],
      pendingAcknowledgements: [["command-1", "claim-1"]],
    })
  })

  it("loads the current Lynvo storage keys", () => {
    const remoteControlPersistence = createRemoteControlPersistence(
      "account-one:session-one"
    )
    localStorage.setItem(
      `${REMOTE_SESSION_ID_KEY}:account-one:session-one`,
      "session-1"
    )
    localStorage.setItem(
      `${REMOTE_DEVICE_NAME_KEY}:account-one:session-one`,
      "Living room"
    )

    expect(remoteControlPersistence.load()).toEqual({
      sessionId: "session-1",
      deviceName: "Living room",
    })
  })

  it("isolates delivery state between accounts and sessions", () => {
    const first = createRemoteControlPersistence("account-one:session-one")
    const second = createRemoteControlPersistence("account-two:session-two")
    first.saveDelivery({
      processed: [["command-one", 1]],
      applied: [],
      pendingAcknowledgements: [],
    })
    expect(second.loadDelivery()).toEqual({
      processed: [],
      applied: [],
      pendingAcknowledgements: [],
    })
  })
})
