export const normalizeUrl = (value: string) => {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ""
  }
  const schemePattern = new RegExp("^([a-z][a-z0-9+.-]*)://", "i")
  if (!schemePattern.test(trimmedValue)) {
    return `https://${trimmedValue}`
  }
  return trimmedValue
}

export const isProbablyValidUrl = (value: string) => {
  try {
    const parsedUrl = new URL(value)
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false
    }
    const { hostname } = parsedUrl
    if (hostname === "localhost") {
      return true
    }
    const hostnameParts = hostname.split(".")
    if (
      hostnameParts.length === 4 &&
      hostnameParts.every(
        (part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255
      )
    ) {
      return true
    }
    if (hostname.indexOf(".") === -1) {
      return false
    }
    const topLevelDomain = hostnameParts[hostnameParts.length - 1]
    if (!topLevelDomain || topLevelDomain.length < 2) {
      return false
    }
    return true
  } catch {
    return false
  }
}
