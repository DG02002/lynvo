import { useEffect, useState } from "react"
import { Result, Schema } from "effect"
import { PluginIcon } from "~/components/plugin-icon"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import {
  PLAYER_LAUNCH_ERROR_EVENT,
  type PlayerLaunchErrorDetail,
} from "~/lib/player-launch-events"

const playerLaunchErrorDetailSchema = Schema.Struct({
  playerName: Schema.String,
  playerIconUrl: Schema.String,
})

export function PlayerLaunchErrorDialog() {
  const [error, setError] = useState<PlayerLaunchErrorDetail | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleLaunchError = (event: Event) => {
      if (event instanceof CustomEvent) {
        const detail = Schema.decodeUnknownResult(
          playerLaunchErrorDetailSchema
        )(event.detail)
        if (Result.isFailure(detail)) {
          return
        }
        setError(detail.success)
        setOpen(true)
      }
    }

    window.addEventListener(PLAYER_LAUNCH_ERROR_EVENT, handleLaunchError)
    return () =>
      window.removeEventListener(PLAYER_LAUNCH_ERROR_EVENT, handleLaunchError)
  }, [])

  return (
    <ConfirmationAlertDialog
      open={open}
      onOpenChange={setOpen}
      media={
        <PluginIcon
          iconUrl={error?.playerIconUrl}
          className="mx-auto size-16"
        />
      }
      title={<>Couldn’t open {error?.playerName}</>}
      description="Make sure the player is installed on your Android device, then try again."
      confirmLabel="OK"
      cancelLabel={null}
      onConfirm={() => setOpen(false)}
    />
  )
}
