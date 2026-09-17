import { useCallback } from "react"
import type { ExtractedLink } from "~/features/links/types"
import { useRemoteControl } from "~/context/remote-control-context"
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
      // The ref blocks a second handoff before the state re-render commits;
      // exhaustive-deps requires it listed even though its identity is stable.
      // oxlint-disable-next-line react/memo-dependencies
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
      // exhaustive-deps requires the context values and the ref; the
      // memo-dependencies heuristic misjudges all three as removable.
      // oxlint-disable-next-line react/memo-dependencies
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
