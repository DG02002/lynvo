import { beforeEach, describe, expect, it, vi } from "vitest"
import { saveLink } from "~/features/links/use-link-actions/save-flow"

describe("Bhadoo save flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("strips inline credentials before persisting the queued save intent", async () => {
    const credentialedUrl =
      "https://source-user:source%40secret@index.example.com/0:/Movies/"
    const sanitizedUrl = "https://index.example.com/0:/Movies/"
    const addLink = vi.fn()
    const enqueueLink = vi.fn().mockResolvedValue("queued-id")

    const result = await saveLink({
      currentUrl: credentialedUrl,
      links: [],
      addLink,
      enqueueLink,
    })

    expect(enqueueLink).toHaveBeenCalledWith(sanitizedUrl)
    expect(addLink).not.toHaveBeenCalled()
    expect(result).toEqual({ kind: "queued", linkId: "queued-id" })
  })

  it("queues a source immediately when auto-save is enabled", async () => {
    const sourceUrl = "https://index.example.com/0:/Shows/"
    const addLink = vi.fn()
    const enqueueLink = vi.fn().mockResolvedValue("saved-id")

    const result = await saveLink({
      currentUrl: sourceUrl,
      links: [],
      addLink,
      enqueueLink,
    })

    expect(enqueueLink).toHaveBeenCalledWith(sourceUrl)
    expect(addLink).not.toHaveBeenCalled()
    expect(result).toEqual({ kind: "queued", linkId: "saved-id" })
  })

  it("reports an error and does not reset view when the queue cannot persist", async () => {
    const sourceUrl = "https://example.com/video.mp4"
    const addLink = vi.fn()
    const enqueueLink = vi.fn().mockResolvedValue(undefined)

    const result = await saveLink({
      currentUrl: sourceUrl,
      links: [],
      addLink,
      enqueueLink,
    })

    expect(result).toEqual({
      kind: "error",
      message: "Unable to save link. Try again.",
    })
  })
})
