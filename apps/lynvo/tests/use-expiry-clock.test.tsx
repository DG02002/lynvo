import { act, renderHook } from "@testing-library/react"
import { useExpiryClock } from "~/components/auth/use-expiry-clock"

describe("useExpiryClock", () => {
  it("expires when only the browser clock advances", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { result } = renderHook(() => useExpiryClock(2_000))

    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current).toBe(true)
    vi.useRealTimers()
  })
})
