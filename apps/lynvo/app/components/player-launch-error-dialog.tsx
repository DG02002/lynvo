import { useEffect, useState } from "react"
import { z } from "zod"

const playerLaunchErrorDetailSchema = z.object({
  playerName: z.string(),
  playerIconUrl: z.string(),
})
import { PluginIcon } from "~/components/plugin-icon"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import {
  PLAYER_LAUNCH_ERROR_EVENT,
  type PlayerLaunchErrorDetail,
} from "~/lib/player-launch-events"

export function PlayerLaunchErrorDialog() {
  const [error, setError] = useState<PlayerLaunchErrorDetail | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleLaunchError = (event: Event) => {
      if (event instanceof CustomEvent) {
        const detail = playerLaunchErrorDetailSchema.safeParse(event.detail)
        if (!detail.success) {
          return
        }
        setError(detail.data)
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
