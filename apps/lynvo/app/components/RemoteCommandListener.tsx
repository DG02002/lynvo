import { useEffect } from "react"
import { useRemoteControl } from "~/context/RemoteControlContext"
import { playableLinkHandoff } from "~/features/links/playable-link-handoff"
import { toast } from "sonner"
import { usePlayerPreferenceIdentity } from "~/context/player-preference-context"

export const RemoteCommandListener = () => {
  const { lastCommand, acknowledgeCommand, markCommandApplied } =
    useRemoteControl()
  const playerPreferenceUserId = usePlayerPreferenceIdentity()

  useEffect(() => {
    if (!lastCommand) {
      return
    }

    const handleCommand = async () => {
      try {
        toast.info("Opening player…")
        markCommandApplied(lastCommand.id)
        await playableLinkHandoff.receive(
          lastCommand.payload,
          playerPreferenceUserId
        )
        acknowledgeCommand(lastCommand.id)
      } catch {
        toast.error("Remote Play couldn’t open this link.")
      }
    }

    void handleCommand()
  }, [
    acknowledgeCommand,
    lastCommand,
    markCommandApplied,
    playerPreferenceUserId,
  ])

  return null
}
