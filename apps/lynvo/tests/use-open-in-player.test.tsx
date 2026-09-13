import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useOpenInPlayer } from "~/features/links/use-open-in-player"

describe("useOpenInPlayer", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  it("marks an accepted handoff", async () => {
    const markOpened = vi.fn()
    const { result } = renderHook(() => useOpenInPlayer())

    await act(async () => {
      result.current(() => Promise.resolve({ accepted: true }), {
        itemLabel: "Video",
        markOpened,
      })
      await Promise.resolve()
    })

    expect(markOpened).toHaveBeenCalledOnce()
  })

  it("logs a rejected open operation", async () => {
    const error = new Error("open failed")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const { result } = renderHook(() => useOpenInPlayer())

    act(() => {
      result.current(() => Promise.reject(error), {
        itemLabel: "Video",
        markOpened: vi.fn(),
      })
    })

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith(error))
  })
})
