import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import type { ExtractedLink } from "~/features/links/types"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"

export interface OpenInPlayerOptions {
  readonly itemLabel: string
  readonly markOpened: () => void
}

const openInPlayerAndMarkOpened = async (
  open: () => Promise<PlaybackHandoffResult>,
  { itemLabel, markOpened }: OpenInPlayerOptions
): Promise<void> => {
  const result = await open()
  markAfterAcceptedHandoff({ ...result, itemLabel, markOpened })
}

export const openInPlayerAndLogError = (
  open: () => Promise<PlaybackHandoffResult>,
  options: OpenInPlayerOptions
): Promise<void> =>
  openInPlayerAndMarkOpened(open, options).catch(console.error)

interface OpenPlayableAndMarkOpenedOptions {
  readonly actions: LinkItemActions
  readonly itemUrl: string
  readonly playableLink: ExtractedLink
  readonly open: () => Promise<PlaybackHandoffResult>
  readonly markOpenedLink?: ExtractedLink
  readonly shouldPropagateError?: boolean
}

export const openPlayableAndMarkOpened = ({
  actions,
  itemUrl,
  playableLink,
  open,
  markOpenedLink = playableLink,
  shouldPropagateError = false,
}: OpenPlayableAndMarkOpenedOptions): Promise<void> => {
  const target = getMediaNodeTargetOrUndefined(markOpenedLink)
  const options: OpenInPlayerOptions = {
    itemLabel: playableLink.label,
    markOpened: () => {
      if (target !== undefined) {
        actions.markOpened(itemUrl, target)
      }
    },
  }

  return shouldPropagateError
    ? openInPlayerAndMarkOpened(open, options)
    : openInPlayerAndLogError(open, options)
}
