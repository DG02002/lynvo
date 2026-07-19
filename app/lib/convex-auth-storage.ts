import type { TokenStorage } from "@convex-dev/auth/react"

const maxAge = 60 * 60 * 24 * 365

const cookieOptions = () => {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : ""
  return `Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

const clearCookieOptions = () => {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : ""
  return `Path=/; SameSite=Lax; Max-Age=0${secure}`
}

export const cookieSyncedAuthStorage: TokenStorage = {
  getItem(key) {
    return localStorage.getItem(key)
  },
  setItem(key, value) {
    localStorage.setItem(key, value)
    document.cookie = `${key}=${encodeURIComponent(value)}; ${cookieOptions()}`
  },
  removeItem(key) {
    localStorage.removeItem(key)
    document.cookie = `${key}=; ${clearCookieOptions()}`
  },
}
