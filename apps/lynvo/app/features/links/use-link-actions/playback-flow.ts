import type { ExtractedLink } from "~/features/links/types"
import { openInPlayer } from "~/lib/player-utils"

export interface PlayLinkTargetOptions {
  target: string | ExtractedLink
  activeSessionId: string | null | undefined
  sendCommand: (command: string, payload?: unknown) => Promise<void>
}

const getTargetUrl = (target: string | ExtractedLink) =>
  typeof target === "string" ? target : target.url

const openPlaybackTarget = async (target: string | ExtractedLink) => {
  const targetUrl = getTargetUrl(target)
  const rangeRequest =
    typeof target === "string" ? "unknown" : target.rangeRequest

  await openInPlayer(targetUrl, { rangeRequest })
}

export const playLinkTarget = async ({
  target,
  activeSessionId,
  sendCommand,
}: PlayLinkTargetOptions) => {
  const targetUrl = getTargetUrl(target)

  if (activeSessionId) {
    await sendCommand("play", { url: targetUrl })
    return
  }

  await openPlaybackTarget(target)
}
