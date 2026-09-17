import { waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { openInPlayerAndLogError } from "~/features/links/open-in-player"

describe("openInPlayerAndLogError", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  it("marks an accepted handoff", async () => {
    const markOpened = vi.fn()

    openInPlayerAndLogError(() => Promise.resolve({ accepted: true }), {
      itemLabel: "Video",
      markOpened,
    })

    await waitFor(() => expect(markOpened).toHaveBeenCalledOnce())
  })

  it("logs a rejected open operation", async () => {
    const error = new Error("open failed")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    openInPlayerAndLogError(() => Promise.reject(error), {
      itemLabel: "Video",
      markOpened: vi.fn(),
    })

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith(error))
  })
})
