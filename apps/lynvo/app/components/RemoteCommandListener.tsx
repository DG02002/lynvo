import { useEffect } from "react"
import { useRemoteControl } from "~/context/RemoteControlContext"
import { openInPlayer } from "~/lib/player-utils"
import { toast } from "sonner"

export function RemoteCommandListener() {
  const { lastCommand, acknowledgeCommand } = useRemoteControl()

  useEffect(() => {
    if (!lastCommand) {
      return
    }

    const handleCommand = async () => {
      try {
        if (lastCommand.command === "play") {
          const payload = lastCommand.payload as { url?: string } | null
          const url = payload?.url
          if (url) {
            toast.info("Opening player…")
            await openInPlayer(url)
          }
        }
      } finally {
        acknowledgeCommand(lastCommand.id)
      }
    }

    handleCommand()
  }, [acknowledgeCommand, lastCommand])

  return null
}
