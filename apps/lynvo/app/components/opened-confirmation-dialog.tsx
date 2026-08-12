import { useEffect, useState } from "react"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { OPENED_CONFIRMATION_EVENT } from "~/lib/opened-confirmation-events"

export const OpenedConfirmationDialog = () => {
  const [confirmation, setConfirmation] =
    useState<OpenedConfirmationDetail | null>(null)

  useEffect(() => {
    const handleConfirmation = (event: Event) => {
      if (event instanceof CustomEvent) {
        setConfirmation(event.detail)
      }
    }

    window.addEventListener(OPENED_CONFIRMATION_EVENT, handleConfirmation)
    return () =>
      window.removeEventListener(OPENED_CONFIRMATION_EVENT, handleConfirmation)
  }, [])

  return (
    <ConfirmationAlertDialog
      open={confirmation !== null}
      onOpenChange={(open) => !open && setConfirmation(null)}
      title="Mark as watched?"
      description={
        confirmation
          ? `Did you watch “${confirmation.itemLabel}”?`
          : "Did you watch this item?"
      }
      confirmLabel="Mark as watched"
      cancelLabel="Not yet"
      onConfirm={() => {
        confirmation?.markOpened()
        setConfirmation(null)
      }}
    />
  )
}
