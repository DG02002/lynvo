import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useOpeningState } from "~/features/links/use-link-actions/interaction-state"
import { OPENING_RESET_DELAY_MS } from "~/features/links/use-link-actions/constants"

const setVisibilityState = (visibilityState: "hidden" | "visible") => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: visibilityState,
  })
}

const startOpeningReset = (
  controls: Pick<
    ReturnType<typeof useOpeningState>,
    "setIsOpening" | "resetOpeningWhenReady"
  >
) => {
  act(() => {
    controls.setIsOpening(true)
    controls.resetOpeningWhenReady()
  })
}

const createVisibilityListenerReader = () => {
  const addEventListener = vi.spyOn(document, "addEventListener")
  return () =>
    addEventListener.mock.calls.find(
      ([eventName]) => eventName === "visibilitychange"
    )?.[1]
}

describe("useOpeningState", () => {
  afterEach(() => {
    setVisibilityState("visible")
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("resets opening and cleans up when the page becomes visible", () => {
    vi.useFakeTimers()
    const removeEventListener = vi.spyOn(document, "removeEventListener")
    const { result } = renderHook(() => useOpeningState())

    startOpeningReset(result.current)
    expect(result.current.isOpening).toBe(true)
    expect(vi.getTimerCount()).toBe(1)

    setVisibilityState("visible")
    act(() => document.dispatchEvent(new Event("visibilitychange")))

    expect(result.current.isOpening).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    expect(removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    )
  })

  it("resets opening and cleans up when the timer expires", () => {
    vi.useFakeTimers()
    const removeEventListener = vi.spyOn(document, "removeEventListener")
    const { result } = renderHook(() => useOpeningState())

    startOpeningReset(result.current)
    expect(result.current.isOpening).toBe(true)

    act(() => vi.advanceTimersByTime(OPENING_RESET_DELAY_MS))

    expect(result.current.isOpening).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    expect(removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    )
  })

  it("cancels an earlier reset when a new one is scheduled", () => {
    vi.useFakeTimers()
    const readVisibilityListener = createVisibilityListenerReader()
    const removeEventListener = vi.spyOn(document, "removeEventListener")
    const { result } = renderHook(() => useOpeningState())

    startOpeningReset(result.current)
    act(() => vi.advanceTimersByTime(OPENING_RESET_DELAY_MS / 2))
    act(() => result.current.resetOpeningWhenReady())

    const firstVisibilityListener = readVisibilityListener()
    expect(vi.getTimerCount()).toBe(1)
    expect(removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      firstVisibilityListener
    )

    act(() => vi.advanceTimersByTime(OPENING_RESET_DELAY_MS / 2))
    expect(result.current.isOpening).toBe(true)

    act(() => vi.advanceTimersByTime(OPENING_RESET_DELAY_MS / 2))
    expect(result.current.isOpening).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("cleans up the visibility listener and timer on unmount", () => {
    vi.useFakeTimers()
    const readVisibilityListener = createVisibilityListenerReader()
    const removeEventListener = vi.spyOn(document, "removeEventListener")
    const { result, unmount } = renderHook(() => useOpeningState())

    startOpeningReset(result.current)

    const visibilityListener = readVisibilityListener()
    expect(result.current.isOpening).toBe(true)
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      visibilityListener
    )
    expect(vi.getTimerCount()).toBe(0)
  })
})
