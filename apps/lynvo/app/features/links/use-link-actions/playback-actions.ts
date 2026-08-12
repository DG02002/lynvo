import { useCallback } from "react"
import type { ExtractedLink } from "~/features/links/types"
import { useRemoteControl } from "~/context/RemoteControlContext"
import { playbackTarget } from "./playback-flow"
import { usePlayerPreferenceIdentity } from "~/context/player-preference-context"

export const usePlaybackActions = ({
  isOpeningRef,
  setIsOpening,
  resetOpeningWhenReady,
}: {
  isOpeningRef: React.RefObject<boolean>
  setIsOpening: (value: boolean) => void
  resetOpeningWhenReady: () => void
}) => {
  const { activeSessionId, sendRemotePlayback } = useRemoteControl()
  const playerPreferenceUserId = usePlayerPreferenceIdentity()

  const handleLinkClick = useCallback(
    async (target: string | ExtractedLink) => {
      if (isOpeningRef.current) {
        return { accepted: false }
      }
      setIsOpening(true)

      try {
        return await playbackTarget.handoff({
          target,
          activeSessionId,
          sendRemotePlayback,
          playerPreferenceUserId,
        })
      } finally {
        resetOpeningWhenReady()
      }
    },
    [
      activeSessionId,
      isOpeningRef,
      playerPreferenceUserId,
      resetOpeningWhenReady,
      sendRemotePlayback,
      setIsOpening,
    ]
  )

  return { handleLinkClick }
}
