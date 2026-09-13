import { useCallback } from "react"
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

export const useOpenInPlayer = () =>
  useCallback(
    (
      open: () => Promise<PlaybackHandoffResult>,
      { itemLabel, markOpened }: OpenInPlayerOptions
    ): void => {
      try {
        void openInPlayerAndMarkOpened(open, { itemLabel, markOpened }).catch(
          console.error
        )
      } catch (error) {
        console.error(error)
      }
    },
    []
  )
