import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAnimationActivity } from "~/features/site/home/use-animation-activity"

const setupIntersectionObserver = () => {
  let observerCallback: IntersectionObserverCallback | undefined

  class ControllableIntersectionObserver {
    readonly root = null
    readonly rootMargin = "0px"
    readonly thresholds = []

    disconnect = vi.fn()
    observe = vi.fn()
    takeRecords = vi.fn(() => [])
    unobserve = vi.fn()

    constructor(callback: IntersectionObserverCallback) {
      observerCallback = callback
    }
  }

  vi.stubGlobal("IntersectionObserver", ControllableIntersectionObserver)

  return (isIntersecting: boolean) => {
    const callback = observerCallback
    if (!callback) {
      throw new Error("Intersection observer was not created")
    }

    // SAFETY: The hook only reads isIntersecting from this observer entry.
    const entry = { isIntersecting } as IntersectionObserverEntry
    // SAFETY: The hook does not read the observer argument.
    const observer = {} as IntersectionObserver
    callback([entry], observer)
  }
}

const AnimationActivityProbe = () => {
  const { animationContainerRef, isAnimationActive } =
    useAnimationActivity<HTMLDivElement>()

  return (
    <div ref={animationContainerRef} data-testid="probe">
      {isAnimationActive ? "active" : "paused"}
    </div>
  )
}

describe("useAnimationActivity", () => {
  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    vi.unstubAllGlobals()
  })

  it("pauses outside the viewport and resumes after re-entry", () => {
    const setIntersection = setupIntersectionObserver()
    render(<AnimationActivityProbe />)

    expect(screen.getByTestId("probe")).toHaveTextContent("active")

    act(() => setIntersection(false))
    expect(screen.getByTestId("probe")).toHaveTextContent("paused")

    act(() => setIntersection(true))
    expect(screen.getByTestId("probe")).toHaveTextContent("active")
  })

  it("pauses while the page is hidden", () => {
    setupIntersectionObserver()
    render(<AnimationActivityProbe />)

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    expect(screen.getByTestId("probe")).toHaveTextContent("paused")

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    expect(screen.getByTestId("probe")).toHaveTextContent("active")
  })
})
