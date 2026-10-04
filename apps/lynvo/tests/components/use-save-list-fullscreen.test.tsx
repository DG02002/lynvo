import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useSaveListFullscreen } from "~/components/save-list/use-save-list-fullscreen"

describe("useSaveListFullscreen", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete document.body.dataset.saveListFullscreen
    document.body.style.overflow = ""
  })

  it("restores the scroll position captured when the immersive view opens", () => {
    const scrollTo = vi.fn()
    let scrollY = 800
    Object.defineProperty(window, "scrollTo", {
      value: scrollTo,
      configurable: true,
    })
    Object.defineProperty(window, "scrollY", {
      get: () => scrollY,
      configurable: true,
    })

    const { result, rerender } = renderHook(
      ({ fullscreen }) => useSaveListFullscreen(fullscreen),
      { initialProps: { fullscreen: false } }
    )

    act(() => {
      result.current.rememberScrollPosition()
    })
    // Entering the immersive route resets the window and collapses the
    // document before the fullscreen effect runs.
    scrollY = 0
    rerender({ fullscreen: true })
    rerender({ fullscreen: false })

    expect(scrollTo).toHaveBeenLastCalledWith(0, 800)
  })

  it("keeps the body usable after the immersive view closes", () => {
    Object.defineProperty(window, "scrollTo", {
      value: vi.fn(),
      configurable: true,
    })

    const { rerender } = renderHook(
      ({ fullscreen }) => useSaveListFullscreen(fullscreen),
      { initialProps: { fullscreen: true } }
    )

    expect(document.body.dataset.saveListFullscreen).toBe("true")
    expect(document.body.style.overflow).toBe("hidden")

    rerender({ fullscreen: false })

    expect(document.body.dataset.saveListFullscreen).toBeUndefined()
    expect(document.body.style.overflow).toBe("")
  })
})
