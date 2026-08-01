import { describe, expect, it, vi } from "vitest"
import { createRemoteControlMachine } from "~/context/remote-control/machine"

const createHarness = ({
  storedSessionId = null,
  storedDeviceName = null,
}: {
  storedSessionId?: string | null
  storedDeviceName?: string | null
} = {}) => {
  let now = 1_000_000
  let pollResponse: RemotePollResponse = {}
  let intervalCallback = () => undefined
  const transport = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    send: vi.fn(async () => undefined),
    poll: vi.fn(async () => pollResponse),
    acknowledge: vi.fn(async () => undefined),
  }
  const persistence = {
    load: vi.fn(() => ({
      sessionId: storedSessionId,
      deviceName: storedDeviceName,
    })),
    save: vi.fn(),
    clear: vi.fn(),
  }
  const machine = createRemoteControlMachine({
    transport,
    persistence,
    clock: {
      now: () => now,
      setInterval: (callback) => {
        intervalCallback = callback
        return 1
      },
      clearInterval: vi.fn(),
    },
  })
  return {
    machine,
    transport,
    persistence,
    setNow: (nextNow: number) => {
      now = nextNow
    },
    setPollResponse: (nextResponse: RemotePollResponse) => {
      pollResponse = nextResponse
    },
    runInterval: () => intervalCallback(),
  }
}

describe("remote-control machine", () => {
  it("hydrates a stored session and confirms connect before persistence", async () => {
    const harness = createHarness({
      storedSessionId: "stored-session",
      storedDeviceName: "Stored TV",
    })
    expect(harness.machine.getSnapshot().activeSessionId).toBe("stored-session")

    const freshHarness = createHarness()
    await freshHarness.machine.connect("tv-1", "Living Room")
    expect(freshHarness.transport.connect).toHaveBeenCalledWith("tv-1")
    expect(freshHarness.persistence.save).toHaveBeenCalledWith(
      "tv-1",
      "Living Room"
    )
    expect(freshHarness.machine.getSnapshot().activeSessionId).toBe("tv-1")
  })

  it("does not persist failed connects or clear failed disconnects", async () => {
    const harness = createHarness()
    harness.transport.connect.mockRejectedValueOnce(new Error("offline"))
    await expect(
      harness.machine.connect("tv-1", "Living Room")
    ).rejects.toThrow("offline")
    expect(harness.persistence.save).not.toHaveBeenCalled()

    const connectedHarness = createHarness({
      storedSessionId: "tv-1",
      storedDeviceName: "Living Room",
    })
    connectedHarness.transport.disconnect.mockRejectedValueOnce(
      new Error("offline")
    )
    await expect(connectedHarness.machine.disconnect()).rejects.toThrow(
      "offline"
    )
    expect(connectedHarness.persistence.clear).not.toHaveBeenCalled()
    expect(connectedHarness.machine.getSnapshot().activeSessionId).toBe("tv-1")
  })

  it("keeps durable polling active while realtime is connected", async () => {
    const harness = createHarness({ storedSessionId: "tv-1" })
    harness.machine.start()
    harness.machine.setRealtimeStatus("disconnected")
    harness.runInterval()
    await vi.waitFor(() =>
      expect(harness.transport.poll).toHaveBeenCalledTimes(1)
    )

    harness.machine.setRealtimeStatus("connected")
    harness.runInterval()
    await vi.waitFor(() =>
      expect(harness.transport.poll).toHaveBeenCalledTimes(2)
    )
  })

  it("classifies polling failures as delivery outcomes", async () => {
    const harness = createHarness({ storedSessionId: "tv-1" })
    const outcomes: RemoteControlOutcome[] = []
    harness.machine.subscribeOutcomes((outcome) => outcomes.push(outcome))
    harness.transport.poll.mockRejectedValueOnce(new Error("unauthorized"))
    harness.machine.start()
    harness.machine.setRealtimeStatus("disconnected")

    harness.runInterval()

    await vi.waitFor(() =>
      expect(outcomes).toContainEqual({ type: "delivery-unavailable" })
    )
  })

  it("deduplicates replayed commands and rejects stale commands", async () => {
    const harness = createHarness()
    harness.machine.receiveCommand(
      "play",
      '{"url":"one"}',
      1_000_000,
      "command-1"
    )
    const firstCommand = harness.machine.getSnapshot().lastCommand
    expect(firstCommand?.payload).toEqual({ url: "one" })
    harness.machine.acknowledgeCommand(firstCommand!.id)
    harness.machine.receiveCommand(
      "play",
      '{"url":"one"}',
      1_000_000,
      "command-1"
    )
    expect(harness.machine.getSnapshot().lastCommand).toBeNull()

    harness.setNow(2_000_000)
    harness.machine.receiveCommand("play", null, 1_000_000, "stale")
    expect(harness.machine.getSnapshot().lastCommand).toBeNull()
  })

  it("applies realtime and durable delivery of one command only once", async () => {
    const harness = createHarness()
    harness.machine.receiveRealtime(
      {
        kind: "command",
        id: "command-1",
        command: "play",
        payload: '{"url":"one"}',
        createdAt: 1_000_000,
        targetSessionId: "receiver-session",
      },
      "receiver-session"
    )
    harness.machine.acknowledgeCommand("command-1")
    harness.setPollResponse({
      commands: [
        {
          id: "command-1",
          command: "play",
          payload: '{"url":"one"}',
          createdAt: 1_000_000,
        },
      ],
    })

    await harness.machine.poll()

    expect(harness.machine.getSnapshot().lastCommand).toBeNull()
    expect(harness.transport.acknowledge).toHaveBeenCalledOnce()
    expect(harness.transport.acknowledge).toHaveBeenCalledWith("command-1")
  })

  it("retries a failed acknowledgement without replaying the command", async () => {
    const harness = createHarness()
    harness.transport.acknowledge.mockRejectedValueOnce(new Error("offline"))
    harness.machine.receiveCommand("play", "{}", 1_000_000, "command-1")

    await harness.machine.acknowledgeCommand("command-1")
    expect(harness.machine.getSnapshot().lastCommand).toBeNull()

    harness.setPollResponse({
      commands: [
        {
          id: "command-1",
          command: "play",
          payload: "{}",
          createdAt: 1_000_000,
        },
      ],
    })
    await harness.machine.poll()

    expect(harness.transport.acknowledge).toHaveBeenCalledTimes(2)
    expect(harness.machine.getSnapshot().lastCommand).toBeNull()
  })

  it("supports legacy and partial polling payloads with identity-aware devices", async () => {
    const harness = createHarness()
    harness.setPollResponse({
      controlledBy: "phone-1",
      controllerName: "Phone",
    })
    await harness.machine.poll()
    expect(harness.machine.getSnapshot().controllingDevices).toEqual([
      { id: "phone-1", name: "Phone" },
    ])

    harness.setPollResponse({})
    await harness.machine.poll()
    expect(harness.machine.getSnapshot().controlledBy).toBe("phone-1")
  })

  it("clears a target that disappears without requiring a network disconnect", async () => {
    const harness = createHarness({ storedSessionId: "tv-1" })
    harness.setPollResponse({ activeTargets: [] })
    await harness.machine.poll()
    expect(harness.machine.getSnapshot().activeSessionId).toBeNull()
    expect(harness.persistence.clear).toHaveBeenCalled()
  })
})
