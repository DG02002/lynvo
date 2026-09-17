import { Schema } from "effect"
import type { ExtractedLink } from "~/features/links/types"
import { getMediaNodeTarget } from "~/features/links/media-node-interaction"
import { openInPlayer, type RangeRequestCapability } from "~/lib/player-utils"
import { remotePlaybackIntentSchema } from "~/lib/remote-play/intent"

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

const isExtractedLink = (
  target: string | ExtractedLink
): target is ExtractedLink => target instanceof Object

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
    return { accepted: launchResult.expectsNavigation }
  },
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- I/O boundary parser: input is an arbitrary unparsed remote playback broadcast payload, and anti-slop/no-unknown-parameters (error) bans spelling that parameter as `unknown`.
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
