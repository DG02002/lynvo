import { useEffect, useRef } from "react"
import { useRemoteControl } from "~/context/RemoteControlContext"
import { playableLinkHandoff } from "~/features/links/playable-link-handoff"
import { toast } from "sonner"
import { usePlayerPreferenceIdentity } from "~/context/player-preference-context"

export const RemoteCommandListener = () => {
  const { lastCommand, acknowledgeCommand, markCommandApplied } =
    useRemoteControl()
  const playerPreferenceUserId = usePlayerPreferenceIdentity()
  const inFlightCommandId = useRef<string | null>(null)

  useEffect(() => {
    if (!lastCommand || inFlightCommandId.current === lastCommand.id) {
      return
    }
    inFlightCommandId.current = lastCommand.id

    const handleCommand = async () => {
      try {
        toast.info("Opening player…")
        await playableLinkHandoff.receive(
          lastCommand.payload,
          playerPreferenceUserId
        )
        markCommandApplied(lastCommand.id)
        acknowledgeCommand(lastCommand.id)
      } catch {
        inFlightCommandId.current = null
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
