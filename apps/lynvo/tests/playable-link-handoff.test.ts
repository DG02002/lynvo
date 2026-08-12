import { describe, expect, it, vi } from "vitest"
import { createPlayableLinkHandoff } from "~/features/links/playable-link-handoff"

const PLAYABLE_LINK = {
  id: "playable-link",
  name: "Video",
  url: "https://example.com/video.mp4",
  rangeRequest: "unsupported",
} satisfies ExtractedLink

describe("playable link handoff", () => {
  it("preserves range capability through Remote Play", async () => {
    const open = vi.fn()
    const sendRemotePlayback = vi.fn()
    const handoff = createPlayableLinkHandoff({ open })

    const result = await handoff.handoff({
      target: PLAYABLE_LINK,
      activeSessionId: "remote-session",
      sendRemotePlayback,
    })

    expect(sendRemotePlayback).toHaveBeenCalledWith({
      url: PLAYABLE_LINK.url,
      rangeRequest: "unsupported",
    })
    expect(open).not.toHaveBeenCalled()
    expect(result).toEqual({ accepted: true })
  })

  it("uses the same intent for local playback", async () => {
    const open = vi.fn().mockResolvedValue({ expectsNavigation: true })
    const handoff = createPlayableLinkHandoff({ open })

    const result = await handoff.handoff({
      target: PLAYABLE_LINK,
      activeSessionId: null,
      sendRemotePlayback: vi.fn(),
    })

    expect(open).toHaveBeenCalledWith({
      url: PLAYABLE_LINK.url,
      rangeRequest: "unsupported",
    })
    expect(result).toEqual({ accepted: true })
  })

  it("reports a rejected local player launch", async () => {
    const handoff = createPlayableLinkHandoff({
      open: vi.fn().mockResolvedValue({ expectsNavigation: false }),
    })

    await expect(
      handoff.handoff({
        target: PLAYABLE_LINK,
        activeSessionId: null,
        sendRemotePlayback: vi.fn(),
      })
    ).resolves.toEqual({ accepted: false })
  })

  it("rejects an invalid received intent before player launch", async () => {
    const open = vi.fn()
    const handoff = createPlayableLinkHandoff({ open })

    await expect(handoff.receive({ url: "not-a-url" })).rejects.toThrow()
    expect(open).not.toHaveBeenCalled()
  })
})
