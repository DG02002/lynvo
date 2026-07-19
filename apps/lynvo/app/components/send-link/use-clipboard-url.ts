import * as React from "react"
import { CLIPBOARD_WRITE_EVENT } from "~/lib/clipboard-events"

const isHttpUrl = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://")

export const useClipboardUrl = ({
  currentUrl,
  setUrl,
  setError,
  onSave,
}: {
  currentUrl: string
  setUrl: (url: string) => void
  setError: (err: string | null) => void
  onSave: (url?: string) => void
}) => {
  const [clipboardUrl, setClipboardUrl] = React.useState<string | null>(null)

  const checkClipboard = React.useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return
    }

    try {
      const text = await navigator.clipboard.readText()
      setClipboardUrl(
        text && text !== currentUrl && isHttpUrl(text) ? text : null
      )
    } catch {
      setClipboardUrl(null)
    }
  }, [currentUrl])

  const pasteClipboardUrl = () => {
    if (!clipboardUrl) {
      return
    }

    setUrl(clipboardUrl)
    setClipboardUrl(null)
    setError(null)
    onSave(clipboardUrl)
  }

  const clearMatchedClipboardUrl = (nextUrl: string) => {
    if (clipboardUrl && nextUrl === clipboardUrl) {
      setClipboardUrl(null)
    }
  }

  React.useEffect(() => {
    void checkClipboard()

    const onFocus = () => void checkClipboard()
    const onPaste = () => void checkClipboard()

    window.addEventListener("focus", onFocus)
    window.addEventListener(CLIPBOARD_WRITE_EVENT, onFocus)
    document.addEventListener("paste", onPaste)

    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener(CLIPBOARD_WRITE_EVENT, onFocus)
      document.removeEventListener("paste", onPaste)
    }
  }, [checkClipboard])

  return {
    clipboardUrl,
    checkClipboard,
    pasteClipboardUrl,
    clearMatchedClipboardUrl,
  }
}
