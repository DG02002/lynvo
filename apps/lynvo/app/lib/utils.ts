export { cn } from "cn"

export function getCsrfToken() {
  if (globalThis.document !== undefined) {
    const meta = document.querySelector('meta[name="csrf-token"]')
    if (meta) {
      return meta.getAttribute("content") || ""
    }
  }
  return ""
}
