import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  markAfterAcceptedHandoff,
  OPENED_CONFIRMATION_EVENT,
} from "~/lib/opened-confirmation-events"

describe("markAfterAcceptedHandoff", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("does not mark an item when the player handoff fails", () => {
    const markOpened = vi.fn()
    const dispatchEvent = vi.spyOn(window, "dispatchEvent")

    markAfterAcceptedHandoff({
      accepted: false,
      itemLabel: "Video",
      markOpened,
    })

    expect(markOpened).not.toHaveBeenCalled()
    expect(dispatchEvent).not.toHaveBeenCalled()
  })

  it("asks before marking an accepted handoff on a small screen", () => {
    const markOpened = vi.fn()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })
    const dispatchEvent = vi.spyOn(window, "dispatchEvent")

    markAfterAcceptedHandoff({
      accepted: true,
      itemLabel: "Video",
      markOpened,
    })

    expect(markOpened).not.toHaveBeenCalled()
    expect(dispatchEvent).toHaveBeenCalledOnce()
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
      type: OPENED_CONFIRMATION_EVENT,
      detail: { itemLabel: "Video", markOpened },
    })
  })

  it("marks an accepted handoff immediately on a larger screen", () => {
    const markOpened = vi.fn()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })

    markAfterAcceptedHandoff({
      accepted: true,
      itemLabel: "Video",
      markOpened,
    })

    expect(markOpened).toHaveBeenCalledOnce()
  })
})
