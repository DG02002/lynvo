import { act, renderHook } from "@testing-library/react"
import {
  MINUTE_MS,
  useMinuteTimeBucket,
} from "../app/lib/use-coarse-time-bucket"

describe("useMinuteTimeBucket", () => {
  it("updates once at the next bucket boundary", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-22T10:00:30.000Z"))
    const { result } = renderHook(() => useMinuteTimeBucket())
    const initialBucket = result.current

    act(() => vi.advanceTimersByTime(MINUTE_MS / 2 - 1))
    expect(result.current).toBe(initialBucket)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(initialBucket + MINUTE_MS)
    vi.useRealTimers()
  })
})
