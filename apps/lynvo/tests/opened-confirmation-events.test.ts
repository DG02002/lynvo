import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  markAfterAcceptedHandoff,
  OPENED_CONFIRMATION_EVENT,
} from "~/lib/opened-confirmation-events"
import { ASK_BEFORE_MARKING_AS_WATCHED_STORAGE_KEY } from "~/lib/settings/opened-confirmation-preference"

describe("markAfterAcceptedHandoff", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.removeItem(ASK_BEFORE_MARKING_AS_WATCHED_STORAGE_KEY)
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

  it("asks before marking an accepted handoff when the preference is enabled", () => {
    const markOpened = vi.fn()
    localStorage.setItem(ASK_BEFORE_MARKING_AS_WATCHED_STORAGE_KEY, "true")
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

  it("marks an accepted handoff immediately when the preference is disabled", () => {
    const markOpened = vi.fn()

    markAfterAcceptedHandoff({
      accepted: true,
      itemLabel: "Video",
      markOpened,
    })

    expect(markOpened).toHaveBeenCalledOnce()
  })
})
