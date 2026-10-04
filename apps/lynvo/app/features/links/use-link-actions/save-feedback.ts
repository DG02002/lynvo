import {
  HIGHLIGHT_CLEAR_DELAY_MS,
  SAVE_FAILED_VIBRATION_PATTERN,
  SAVE_START_VIBRATION_MS,
  SAVE_SUCCESS_VIBRATION_MS,
} from "./constants"

// Vibration is best-effort feedback: on browsers without support, or when
// the call fails, dropping it silently must never surface as a save error.
const vibrate = (pattern: number | number[]) => {
  try {
    if (globalThis.navigator !== undefined && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  } catch {}
}

export const vibrateSaveStart = () => vibrate(SAVE_START_VIBRATION_MS)

export const vibrateSaveSuccess = () => vibrate(SAVE_SUCCESS_VIBRATION_MS)

export const vibrateSaveFailure = () =>
  vibrate([...SAVE_FAILED_VIBRATION_PATTERN])

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
