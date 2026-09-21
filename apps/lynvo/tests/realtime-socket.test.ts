import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  openRealtimeSocket,
  REALTIME_RECONNECT_FAILURE_STORAGE_KEY,
} from "~/context/realtime/socket"

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3

  readonly url: string
  readyState = MockWebSocket.CONNECTING
  private readonly listeners = new Map<string, Set<EventListener>>()

  constructor(url: string) {
    this.url = url
    mockSockets.push(this)
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
    this.emit("close", createCloseEvent(1000))
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN
    this.emit("open", new Event("open"))
  }

  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

const mockSockets: MockWebSocket[] = []

// SAFETY: The socket only reads the close code from these test events.
const createCloseEvent = (code: number): CloseEvent => ({ code }) as CloseEvent

const openSocket = () =>
  openRealtimeSocket({
    dispatch: vi.fn(),
    receiveMessage: vi.fn(),
    onOpen: vi.fn(),
    onSessionRevoked: vi.fn(),
  })

const stubReconnectTiming = () => {
  const now = 1_000_000
  vi.spyOn(Date, "now").mockReturnValue(now)
  vi.spyOn(Math, "random").mockReturnValue(0.5)
  const scheduledDelays: number[] = []
  vi.spyOn(window, "setTimeout").mockImplementation(
    (_handler: TimerHandler, timeout?: number) => {
      // jsdom dispatches storage events with zero-delay timers in CI.
      if ((timeout ?? 0) > 0) {
        scheduledDelays.push(timeout ?? 0)
      }
      return 1
    }
  )
  return { now, scheduledDelays }
}

describe("realtime socket reconnect backoff", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    mockSockets.length = 0
    vi.stubGlobal("WebSocket", MockWebSocket)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.sessionStorage.clear()
  })

  it("seeds the reconnect delay from recent failures in sessionStorage", () => {
    const { now, scheduledDelays } = stubReconnectTiming()
    const previousFailures = [now - 20_000, now - 10_000]
    window.sessionStorage.setItem(
      REALTIME_RECONNECT_FAILURE_STORAGE_KEY,
      JSON.stringify(previousFailures)
    )

    const connection = openSocket()
    mockSockets[0]?.emit("close", createCloseEvent(1006))

    expect(scheduledDelays).toEqual([4_000])
    expect(
      JSON.parse(
        window.sessionStorage.getItem(REALTIME_RECONNECT_FAILURE_STORAGE_KEY) ??
          "[]"
      )
    ).toEqual([...previousFailures, now])
    connection.close()
  })

  it("discards failures older than the reconnect window", () => {
    const { now, scheduledDelays } = stubReconnectTiming()
    window.sessionStorage.setItem(
      REALTIME_RECONNECT_FAILURE_STORAGE_KEY,
      JSON.stringify([now - 60_001])
    )

    const connection = openSocket()
    mockSockets[0]?.emit("close", createCloseEvent(1006))

    expect(scheduledDelays).toEqual([1_000])
    expect(
      JSON.parse(
        window.sessionStorage.getItem(REALTIME_RECONNECT_FAILURE_STORAGE_KEY) ??
          "[]"
      )
    ).toEqual([now])
    connection.close()
  })

  it("ignores future-dated failures instead of extending the backoff", () => {
    const { now, scheduledDelays } = stubReconnectTiming()
    window.sessionStorage.setItem(
      REALTIME_RECONNECT_FAILURE_STORAGE_KEY,
      JSON.stringify([now + 1_000])
    )

    const connection = openSocket()
    mockSockets[0]?.emit("close", createCloseEvent(1006))

    expect(scheduledDelays).toEqual([1_000])
    expect(
      JSON.parse(
        window.sessionStorage.getItem(REALTIME_RECONNECT_FAILURE_STORAGE_KEY) ??
          "[]"
      )
    ).toEqual([now])
    connection.close()
  })

  it("clears persisted failures after a successful connection", () => {
    const { now } = stubReconnectTiming()
    window.sessionStorage.setItem(
      REALTIME_RECONNECT_FAILURE_STORAGE_KEY,
      JSON.stringify([now - 1_000])
    )

    const connection = openSocket()
    mockSockets[0]?.open()

    expect(
      window.sessionStorage.getItem(REALTIME_RECONNECT_FAILURE_STORAGE_KEY)
    ).toBeNull()
    connection.close()
  })
})
