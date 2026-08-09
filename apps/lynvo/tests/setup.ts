import "@testing-library/jest-dom"
import { vi } from "vitest"

class IntersectionObserverMock {
  readonly root = null
  readonly rootMargin = "0px"
  readonly thresholds = []

  disconnect = vi.fn()
  observe = vi.fn()
  takeRecords = vi.fn(() => [])
  unobserve = vi.fn()
}

vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
