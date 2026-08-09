import { useEffect } from "react"
import { useRemoteControl } from "~/context/RemoteControlContext"
import { playableLinkHandoff } from "~/features/links/playable-link-handoff"
import { toast } from "sonner"

export const RemoteCommandListener = () => {
  const { lastCommand, acknowledgeCommand } = useRemoteControl()

  useEffect(() => {
    if (!lastCommand) {
      return
    }

    const handleCommand = async () => {
      try {
        toast.info("Opening player…")
        await playableLinkHandoff.receive(lastCommand.payload)
        acknowledgeCommand(lastCommand.id)
      } catch {
        toast.error("Remote Play couldn’t open this link.")
      }
    }

    void handleCommand()
  }, [acknowledgeCommand, lastCommand])

  return null
}
