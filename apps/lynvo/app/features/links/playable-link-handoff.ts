import { z } from "zod"
import type { ExtractedLink } from "~/features/links/types"
import { getMediaNodeTarget } from "~/features/links/media-node-interaction"
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
    readonly playerPreferenceUserId?: string
  }

  interface PlayableLinkHandoffDependencies {
    readonly open: (
      intent: RemotePlaybackIntent & { playerPreferenceUserId?: string }
    ) => Promise<unknown>
  }
}

export const parseRemotePlaybackIntent = (value: unknown) =>
  remotePlaybackIntentSchema.safeParse(value)

const toRemotePlaybackIntent = (
  target: string | ExtractedLink
): RemotePlaybackIntent => ({
  url: typeof target === "string" ? target : getMediaNodeTarget(target),
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
    playerPreferenceUserId,
  }: PlayableLinkHandoffOptions) => {
    const intent = toRemotePlaybackIntent(target)
    if (activeSessionId) {
      await sendRemotePlayback(intent)
      return
    }
    await open({ ...intent, playerPreferenceUserId })
  },
  receive: async (value: unknown, playerPreferenceUserId?: string) => {
    const intent = remotePlaybackIntentSchema.parse(value)
    await open({ ...intent, playerPreferenceUserId })
  },
})

export const playableLinkHandoff = createPlayableLinkHandoff({
  open: (intent) =>
    openInPlayer(intent.url, {
      rangeRequest: intent.rangeRequest,
      userId: intent.playerPreferenceUserId,
    }),
})
