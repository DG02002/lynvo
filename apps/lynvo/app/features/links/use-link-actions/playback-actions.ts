import { useCallback } from "react"

import { usePlayerPreferenceIdentity } from "~/context/player-preference-context"
import { useRemoteControl } from "~/context/remote-control-context"
import { playableLinkHandoff } from "~/features/links/playable-link-handoff"
import type { ExtractedLink } from "~/features/links/types"

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
        return await playableLinkHandoff.handoff({
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
      // exhaustive-deps requires these inputs, while memo-dependencies
      // incorrectly treats the context values as removable.
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
