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
  interface PlaybackHandoffResult {
    readonly accepted: boolean
  }

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
    ) => Promise<PlayerLaunchOutcome>
  }

  interface PlayerLaunchOutcome {
    readonly expectsNavigation: boolean
  }
}

export const parseRemotePlaybackIntent = <Value>(value: Value) =>
  remotePlaybackIntentSchema.safeParse(value)

const isString = <Value>(value: Value): value is Value & string =>
  z.string().safeParse(value).success

const toRemotePlaybackIntent = (
  target: string | ExtractedLink
): RemotePlaybackIntent => {
  if (isString(target)) {
    return { url: target, rangeRequest: "unknown" }
  }
  return {
    url: getMediaNodeTarget(target),
    rangeRequest: target.rangeRequest ?? "unknown",
  }
}

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
      return { accepted: true }
    }
    const launchResult = await open({ ...intent, playerPreferenceUserId })
    const result = z
      .object({ expectsNavigation: z.literal(true) })
      .safeParse(launchResult)
    return { accepted: result.success }
  },
  receive: async <Value>(value: Value, playerPreferenceUserId?: string) => {
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
