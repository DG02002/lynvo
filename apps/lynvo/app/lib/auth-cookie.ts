export const getCookieValueFromHeader = (
  cookieHeader: string | null,
  cookieName: string
): string | undefined => {
  for (const cookie of (cookieHeader ?? "").split(";")) {
    const separatorIndex = cookie.indexOf("=")
    if (separatorIndex < 0) {
      continue
    }
    const name = cookie.slice(0, separatorIndex).trim()
    if (name === cookieName) {
      return decodeURIComponent(cookie.slice(separatorIndex + 1))
    }
  }
  return undefined
}

export const getCookieValue = (
  request: Request,
  cookieName: string
): string | undefined =>
  getCookieValueFromHeader(request.headers.get("Cookie"), cookieName)

export const normalizeReturnTo = (value: string | undefined): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/"
  }
  return value
}
