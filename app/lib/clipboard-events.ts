export const CLIPBOARD_WRITE_EVENT = "lynvo:clipboard-write"

export const notifyClipboardWrite = () => {
  window.dispatchEvent(new Event(CLIPBOARD_WRITE_EVENT))
}
