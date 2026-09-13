import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"

export interface OpenInPlayerOptions {
  readonly itemLabel: string
  readonly markOpened: () => void
}

export const openInPlayerAndMarkOpened = async (
  open: () => Promise<PlaybackHandoffResult>,
  { itemLabel, markOpened }: OpenInPlayerOptions
): Promise<void> => {
  const result = await open()
  markAfterAcceptedHandoff({ ...result, itemLabel, markOpened })
}

export const openInPlayerAndLogError = (
  open: () => Promise<PlaybackHandoffResult>,
  options: OpenInPlayerOptions
): void => {
  void openInPlayerAndMarkOpened(open, options).catch(console.error)
}
