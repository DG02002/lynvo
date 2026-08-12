export const OPENED_CONFIRMATION_EVENT = "lynvo:opened-confirmation"
export const SMALL_SCREEN_MEDIA_QUERY = "(max-width: 639px)"

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

  if (window.matchMedia(SMALL_SCREEN_MEDIA_QUERY).matches) {
    window.dispatchEvent(
      new CustomEvent<OpenedConfirmationDetail>(OPENED_CONFIRMATION_EVENT, {
        detail: { itemLabel, markOpened },
      })
    )
    return
  }

  markOpened()
}
