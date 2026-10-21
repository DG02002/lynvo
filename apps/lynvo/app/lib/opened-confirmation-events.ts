import { getShouldAskBeforeMarkingAsWatched } from "~/lib/settings/opened-confirmation-preference"

export const OPENED_CONFIRMATION_EVENT = "lynvo:opened-confirmation"

declare global {
  interface OpenedConfirmationDetail {
    readonly itemLabel: string
    readonly markOpened: () => void
  }
}

export const markAfterAcceptedHandoff = ({
  accepted,
  itemLabel,
  markOpened,
}: PlaybackHandoffResult & OpenedConfirmationDetail) => {
  if (!accepted) {
    return
  }

  if (getShouldAskBeforeMarkingAsWatched()) {
    window.dispatchEvent(
      new CustomEvent<OpenedConfirmationDetail>(OPENED_CONFIRMATION_EVENT, {
        detail: { itemLabel, markOpened },
      })
    )
    return
  }

  markOpened()
}
