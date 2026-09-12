import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useOpeningState } from "~/features/links/use-link-actions/interaction-state"

describe("useOpeningState", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("cleans up the visibility listener and timer on unmount", () => {
    vi.useFakeTimers()
    const addEventListener = vi.spyOn(document, "addEventListener")
    const removeEventListener = vi.spyOn(document, "removeEventListener")
    const { result, unmount } = renderHook(() => useOpeningState())

    act(() => result.current.resetOpeningWhenReady())

    const visibilityListener = addEventListener.mock.calls.find(
      ([eventName]) => eventName === "visibilitychange"
    )?.[1]
    expect(visibilityListener).toEqual(expect.any(Function))
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      visibilityListener
    )
    expect(vi.getTimerCount()).toBe(0)
  })
})
