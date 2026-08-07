import * as React from "react"
import { CLIPBOARD_WRITE_EVENT } from "~/lib/clipboard-events"

const isHttpUrl = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://")

export const useClipboardUrl = ({
  currentUrl,
  savedUrls,
  setUrl,
  setError,
  onSave,
}: {
  currentUrl: string
  savedUrls: ReadonlySet<string>
  setUrl: (url: string) => void
  setError: (err: string | null) => void
  onSave: (url?: string) => void
}) => {
  const [clipboardUrl, setClipboardUrl] = React.useState<string | null>(null)
  const [clipboardPermission, setClipboardPermission] = React.useState<
    PermissionState | "checking" | "unsupported"
  >("checking")
  const skipNextGrantedRead = React.useRef(false)
  const availableClipboardUrl =
    clipboardUrl && !savedUrls.has(clipboardUrl) ? clipboardUrl : null

  const readClipboard = React.useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setClipboardPermission("unsupported")
      return
    }

    try {
      const text = await navigator.clipboard.readText()
      setClipboardPermission("granted")
      setClipboardUrl(
        text && text !== currentUrl && !savedUrls.has(text) && isHttpUrl(text)
          ? text
          : null
      )
    } catch {
      setClipboardUrl(null)
    }
  }, [currentUrl, savedUrls])

  const checkClipboard = React.useCallback(async () => {
    if (clipboardPermission !== "granted") {
      return
    }
    await readClipboard()
  }, [clipboardPermission, readClipboard])

  const pasteClipboardUrl = () => {
    if (!availableClipboardUrl) {
      return
    }

    setUrl(availableClipboardUrl)
    setClipboardUrl(null)
    setError(null)
    onSave(availableClipboardUrl)
  }

  const clearMatchedClipboardUrl = (nextUrl: string) => {
    if (availableClipboardUrl && nextUrl === availableClipboardUrl) {
      setClipboardUrl(null)
    }
  }

  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- the asynchronous listener is removed by this effect's teardown
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setClipboardPermission("unsupported")
      return
    }

    if (!navigator.permissions) {
      setClipboardPermission("unsupported")
      return
    }

    let permissionStatus: PermissionStatus | undefined
    let permissionChangeHandler: (() => void) | undefined
    let isActive = true

    void navigator.permissions
      .query({ name: "clipboard-read" as PermissionName })
      .then((status) => {
        if (!isActive) {
          return
        }
        permissionStatus = status
        permissionChangeHandler = () => setClipboardPermission(status.state)
        permissionChangeHandler()
        status.addEventListener("change", permissionChangeHandler)
      })
      .catch(() => {
        if (isActive) {
          setClipboardPermission("unsupported")
        }
      })

    return () => {
      isActive = false
      if (permissionStatus && permissionChangeHandler) {
        permissionStatus.removeEventListener("change", permissionChangeHandler)
      }
    }
  }, [])

  React.useEffect(() => {
    if (clipboardPermission !== "granted") {
      return
    }

    if (skipNextGrantedRead.current) {
      skipNextGrantedRead.current = false
    } else {
      void readClipboard()
    }

    const onFocus = () => void readClipboard()
    const onPaste = () => void readClipboard()

    window.addEventListener("focus", onFocus)
    window.addEventListener(CLIPBOARD_WRITE_EVENT, onFocus)
    document.addEventListener("paste", onPaste)

    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener(CLIPBOARD_WRITE_EVENT, onFocus)
      document.removeEventListener("paste", onPaste)
    }
  }, [clipboardPermission, readClipboard])

  return {
    clipboardUrl: availableClipboardUrl,
    clipboardPermission,
    checkClipboard,
    requestClipboardAccess: async () => {
      skipNextGrantedRead.current = true
      await readClipboard()
    },
    pasteClipboardUrl,
    clearMatchedClipboardUrl,
  }
}
