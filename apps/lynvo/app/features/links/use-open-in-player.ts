import { useCallback } from "react"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"

export interface OpenInPlayerOptions {
  readonly itemLabel: string
  readonly markOpened: () => void
}

export const useOpenInPlayer = () =>
  useCallback(
    (
      open: () => Promise<PlaybackHandoffResult>,
      { itemLabel, markOpened }: OpenInPlayerOptions
    ): void => {
      try {
        void open()
          .then((result) =>
            markAfterAcceptedHandoff({ ...result, itemLabel, markOpened })
          )
          .catch(console.error)
      } catch (error) {
        console.error(error)
      }
    },
    []
  )
