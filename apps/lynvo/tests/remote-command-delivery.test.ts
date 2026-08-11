import { describe, expect, it, vi } from "vitest"
import {
  createRemoteCommandDelivery,
  parseRemoteCommandWirePayload,
} from "~/context/remote-control/command-delivery"
import { REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS } from "~/context/remote-control/constants"

const createCommand = (
  overrides: Partial<RemoteCommandDeliveryInput> = {}
): RemoteCommandDeliveryInput => ({
  id: "command-1",
  claimToken: "claim-1",
  command: "play",
  payload: { url: "https://example.com/video", rangeRequest: "unknown" },
  createdAt: 1_000_000,
  ...overrides,
})

const createHarness = () => {
  let now = 1_000_000
  let shouldFailAcknowledgement = false
  let record: RemoteCommandDeliveryRecord = {
    processed: [],
    applied: [],
    pendingAcknowledgements: [],
  }
  const reportApplied = vi.fn(async () => {
    if (shouldFailAcknowledgement) {
      shouldFailAcknowledgement = false
      throw new Error("offline")
    }
  })
  const delivery = createRemoteCommandDelivery({
    reportApplied,
    now: () => now,
    persistence: {
      loadDelivery: () => record,
      saveDelivery: (nextRecord) => {
        record = structuredClone(nextRecord)
      },
    },
  })

  return {
    delivery,
    acknowledge: reportApplied,
    setNow: (nextNow: number) => {
      now = nextNow
    },
    failNextAcknowledgement: () => {
      shouldFailAcknowledgement = true
    },
    getRecord: () => record,
  }
}

describe("remote command delivery", () => {
  it("converges realtime and polling deliveries through the command id", async () => {
    const harness = createHarness()

    expect(harness.delivery.receive(createCommand())).toBe(true)
    expect(harness.delivery.receive(createCommand())).toBe(false)
    expect(harness.delivery.getSnapshot().lastCommand?.id).toBe("command-1")

    harness.delivery.markApplied("command-1")
    await harness.delivery.acknowledge("command-1")

    expect(harness.delivery.getSnapshot().lastCommand).toBeNull()
    expect(harness.delivery.receive(createCommand())).toBe(false)
    expect(harness.acknowledge).toHaveBeenCalledOnce()
  })

  it("rejects stale commands before they enter delivery state", () => {
    const harness = createHarness()
    harness.setNow(1_000_000 + 5 * 60 * 1000 + 1)

    expect(harness.delivery.receive(createCommand())).toBe(false)
    expect(harness.delivery.getSnapshot().lastCommand).toBeNull()
  })

  it("retries a failed acknowledgement without replaying the command", async () => {
    const harness = createHarness()
    harness.failNextAcknowledgement()
    harness.delivery.receive(createCommand())

    harness.delivery.markApplied("command-1")
    await harness.delivery.acknowledge("command-1")
    await harness.delivery.retryPendingAcknowledgements()

    expect(harness.acknowledge).toHaveBeenCalledTimes(2)
    expect(harness.delivery.getSnapshot().lastCommand).toBeNull()
    expect(harness.delivery.receive(createCommand())).toBe(false)
  })

  it("expires completed command identities after the deduplication window", async () => {
    const harness = createHarness()
    harness.delivery.receive(createCommand())
    harness.delivery.markApplied("command-1")
    await harness.delivery.acknowledge("command-1")
    harness.setNow(1_000_000 + REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS + 1)

    expect(
      harness.delivery.receive(
        createCommand({
          createdAt: 1_000_000 + REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS + 1,
        })
      )
    ).toBe(true)
  })

  it("does not replay an applied command after a new delivery instance starts", async () => {
    const harness = createHarness()
    harness.failNextAcknowledgement()
    harness.delivery.receive(createCommand())
    harness.delivery.markApplied("command-1")
    await harness.delivery.acknowledge("command-1")

    const recoveredAcknowledge = vi.fn(async () => undefined)
    const recovered = createRemoteCommandDelivery({
      reportApplied: recoveredAcknowledge,
      now: () => 1_000_001,
      persistence: {
        loadDelivery: harness.getRecord,
        saveDelivery: vi.fn(),
      },
    })

    expect(recovered.receive(createCommand())).toBe(false)
    await recovered.retryPendingAcknowledgements()
    expect(recoveredAcknowledge).toHaveBeenCalledWith("command-1", "claim-1")
  })

  it("acknowledges a reclaimed applied command with the newest claim", async () => {
    const harness = createHarness()
    harness.failNextAcknowledgement()
    harness.delivery.receive(createCommand())
    harness.delivery.markApplied("command-1")
    await harness.delivery.acknowledge("command-1")

    expect(
      harness.delivery.receive(createCommand({ claimToken: "claim-2" }))
    ).toBe(false)
    await harness.delivery.retryPendingAcknowledgements()

    expect(harness.acknowledge).toHaveBeenLastCalledWith("command-1", "claim-2")
    expect(harness.delivery.getSnapshot().lastCommand).toBeNull()
  })

  it("uses one strict conversion path for wire commands", () => {
    expect(
      parseRemoteCommandWirePayload({
        kind: "command",
        id: "command-1",
        claimToken: "claim-1",
        command: "play",
        payload: '{"url":"https://example.com/video"}',
        createdAt: 1_000_000,
        targetSessionId: "session-1",
      })
    ).toEqual({
      id: "command-1",
      claimToken: "claim-1",
      command: "play",
      payload: {
        url: "https://example.com/video",
        rangeRequest: "unknown",
      },
      createdAt: 1_000_000,
    })

    expect(
      parseRemoteCommandWirePayload({
        kind: "command",
        command: "play",
        payload: "{}",
        createdAt: 1_000_000,
        targetSessionId: "session-1",
      })
    ).toBeUndefined()
  })
})
