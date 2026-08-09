import { z } from "zod"
import type { ExtractedLink } from "~/features/links/types"
import { openInPlayer, type RangeRequestCapability } from "~/lib/player-utils"

export const remotePlaybackIntentSchema = z.object({
  url: z.url(),
  rangeRequest: z
    .enum(["supported", "unsupported", "unknown"])
    .default("unknown"),
})

declare global {
  interface RemotePlaybackIntent {
    readonly url: string
    readonly rangeRequest: RangeRequestCapability
  }

  interface PlayableLinkHandoffOptions {
    readonly target: string | ExtractedLink
    readonly activeSessionId: string | null | undefined
    readonly sendRemotePlayback: (intent: RemotePlaybackIntent) => Promise<void>
  }

  interface PlayableLinkHandoffDependencies {
    readonly open: (intent: RemotePlaybackIntent) => Promise<unknown>
  }
}

export const parseRemotePlaybackIntent = (value: unknown) =>
  remotePlaybackIntentSchema.safeParse(value)

const toRemotePlaybackIntent = (
  target: string | ExtractedLink
): RemotePlaybackIntent => ({
  url: typeof target === "string" ? target : target.url,
  rangeRequest:
    typeof target === "string" ? "unknown" : (target.rangeRequest ?? "unknown"),
})

export const createPlayableLinkHandoff = ({
  open,
}: PlayableLinkHandoffDependencies) => ({
  handoff: async ({
    target,
    activeSessionId,
    sendRemotePlayback,
  }: PlayableLinkHandoffOptions) => {
    const intent = toRemotePlaybackIntent(target)
    if (activeSessionId) {
      await sendRemotePlayback(intent)
      return
    }
    await open(intent)
  },
  receive: async (value: unknown) => {
    const intent = remotePlaybackIntentSchema.parse(value)
    await open(intent)
  },
})

export const playableLinkHandoff = createPlayableLinkHandoff({
  open: (intent) =>
    openInPlayer(intent.url, { rangeRequest: intent.rangeRequest }),
})
