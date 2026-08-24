import { act, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import Pricing from "~/features/site/routes/_site.pricing"
import { MOBILE_PRICING_CONTROLS_HEIGHT_PX } from "~/lib/constants"

describe("Pricing mobile controls", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps the controls' document space reserved while they are fixed", () => {
    const observerCallbacks: Array<IntersectionObserverCallback> = []

    class ControllableIntersectionObserver {
      readonly root = null
      readonly rootMargin = "0px"
      readonly thresholds = []

      constructor(callback: IntersectionObserverCallback) {
        observerCallbacks.push(callback)
      }

      disconnect = vi.fn()
      observe = vi.fn()
      takeRecords = vi.fn(() => [])
      unobserve = vi.fn()
    }

    vi.stubGlobal("IntersectionObserver", ControllableIntersectionObserver)

    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    )

    act(() => {
      // SAFETY: The component only reads isIntersecting from this observer entry.
      observerCallbacks[0](
        [{ isIntersecting: true } as IntersectionObserverEntry],
        // SAFETY: The component does not read the observer argument.
        {} as IntersectionObserver
      )
      // SAFETY: The component only reads the two rectangle fields supplied by this entry.
      observerCallbacks[1](
        [
          {
            boundingClientRect: { top: 900 },
            rootBounds: { bottom: 800 },
          } as IntersectionObserverEntry,
        ],
        // SAFETY: The component does not read the observer argument.
        {} as IntersectionObserver
      )
    })

    const fixedControls = screen.getByRole("link", {
      name: /Get Free/,
    }).parentElement

    expect(fixedControls).toHaveClass("fixed")
    expect(fixedControls?.parentElement).toHaveStyle({
      height: `${MOBILE_PRICING_CONTROLS_HEIGHT_PX}px`,
    })

    act(() => {
      // SAFETY: The component only reads the two rectangle fields supplied by this entry.
      observerCallbacks[1](
        [
          {
            boundingClientRect: { top: -1 },
            rootBounds: { bottom: 800 },
          } as IntersectionObserverEntry,
        ],
        // SAFETY: The component does not read the observer argument.
        {} as IntersectionObserver
      )
    })

    expect(
      screen.queryByRole("link", { name: /Get Free/ })
    ).not.toBeInTheDocument()
  })
})
