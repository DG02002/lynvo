export function normalizeUrl(value: string) {
  const v = value.trim()
  if (!v) {
    return ""
  }
  const schemeRe = new RegExp("^([a-z][a-z0-9+.-]*)://", "i")
  if (!schemeRe.test(v)) {
    return "https://" + v
  }
  return v
}

export function isProbablyValidUrl(v: string) {
  try {
    const u = new URL(v)
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return false
    }
    const host = u.hostname
    if (host === "localhost") {
      return true
    }
    const parts = host.split(".")
    if (
      parts.length === 4 &&
      parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255)
    ) {
      return true
    }
    if (host.indexOf(".") === -1) {
      return false
    }
    const tld = parts[parts.length - 1]
    if (!tld || tld.length < 2) {
      return false
    }
    return true
  } catch {
    return false
  }
}
