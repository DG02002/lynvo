import { useCallback } from "react"
import type { ExtractedLink } from "~/features/links/types"
import { useRemoteControl } from "~/context/RemoteControlContext"
import { playbackTarget } from "./playback-flow"

export const usePlaybackActions = ({
  isOpeningRef,
  setIsOpening,
  resetOpeningWhenReady,
}: {
  isOpeningRef: React.RefObject<boolean>
  setIsOpening: (value: boolean) => void
  resetOpeningWhenReady: () => void
}) => {
  const { activeSessionId, sendCommand } = useRemoteControl()

  const handleLinkClick = useCallback(
    async (target: string | ExtractedLink) => {
      if (isOpeningRef.current) {
        return
      }
      setIsOpening(true)

      try {
        await playbackTarget({ target, activeSessionId, sendCommand })
      } finally {
        resetOpeningWhenReady()
      }
    },
    [
      activeSessionId,
      isOpeningRef,
      resetOpeningWhenReady,
      sendCommand,
      setIsOpening,
    ]
  )

  return { handleLinkClick }
}
