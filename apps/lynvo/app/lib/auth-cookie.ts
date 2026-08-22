export const getCookieValue = (
  request: Request,
  cookieName: string
): string | undefined => {
  const cookieHeader = request.headers.get("Cookie") ?? ""
  for (const cookie of cookieHeader.split(";")) {
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

export const normalizeReturnTo = (value: string | undefined): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/"
  }
  return value
}
