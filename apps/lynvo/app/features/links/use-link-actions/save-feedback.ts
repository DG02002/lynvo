import {
  HIGHLIGHT_CLEAR_DELAY_MS,
  SAVE_START_VIBRATION_MS,
  SAVE_SUCCESS_VIBRATION_MS,
} from "./constants"

export const vibrate = (durationMs: number) => {
  try {
    if (globalThis.navigator !== undefined && navigator.vibrate) {
      navigator.vibrate(durationMs)
    }
  } catch {}
}

export const vibrateSaveStart = () => vibrate(SAVE_START_VIBRATION_MS)

export const vibrateSaveSuccess = () => vibrate(SAVE_SUCCESS_VIBRATION_MS)

export const clearHighlightAfterDelay = (
  setHighlightedId: (id: string | null) => void
) => {
  setTimeout(() => setHighlightedId(null), HIGHLIGHT_CLEAR_DELAY_MS)
}

export const resetSaveView = ({
  setCurrentUrl,
}: {
  setCurrentUrl: (url: string) => void
}) => {
  setCurrentUrl("")
}
