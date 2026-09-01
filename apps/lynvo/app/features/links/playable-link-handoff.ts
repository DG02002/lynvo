import { Effect, Schema } from "effect"
import type { ExtractedLink } from "~/features/links/types"
import { getMediaNodeTarget } from "~/features/links/media-node-interaction"
import { openInPlayer, type RangeRequestCapability } from "~/lib/player-utils"

export const remotePlaybackIntentSchema = Schema.Struct({
  url: Schema.String.pipe(
    Schema.refine(
      (val): val is string => {
        try {
          const parsedUrl = new URL(val)
          return parsedUrl.protocol.length > 0
        } catch {
          return false
        }
      },
      { message: "Invalid URL" }
    )
  ),
  rangeRequest: Schema.Literals(["supported", "unsupported", "unknown"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("unknown" as const))
  ),
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
  Schema.decodeUnknownResult(remotePlaybackIntentSchema)(value)

const isExtractedLink = (
  target: string | ExtractedLink
): target is ExtractedLink => String(target) !== target

const toRemotePlaybackIntent = (
  target: string | ExtractedLink
): RemotePlaybackIntent => {
  if (isExtractedLink(target)) {
    return {
      url: getMediaNodeTarget(target),
      rangeRequest: target.rangeRequest ?? "unknown",
    }
  }
  return { url: target, rangeRequest: "unknown" }
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
    return { accepted: launchResult.expectsNavigation === true }
  },
  receive: async <Value>(value: Value, playerPreferenceUserId?: string) => {
    const intent = Schema.decodeUnknownSync(remotePlaybackIntentSchema)(value)
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
