import {
  COOKIE_PREFERENCES_STORAGE_KEY,
  COOKIE_PREFERENCES_VERSION,
} from "./constants"

export const defaultCookiePreferences: CookiePreferences = {
  analytics: false,
  marketingMeasurement: false,
  personalizedMarketing: false,
  version: COOKIE_PREFERENCES_VERSION,
}

const isCookiePreferences = (value: unknown): value is CookiePreferences => {
  if (!value || typeof value !== "object") {
    return false
  }

  return (
    "analytics" in value &&
    typeof value.analytics === "boolean" &&
    "marketingMeasurement" in value &&
    typeof value.marketingMeasurement === "boolean" &&
    "personalizedMarketing" in value &&
    typeof value.personalizedMarketing === "boolean" &&
    "version" in value &&
    value.version === COOKIE_PREFERENCES_VERSION
  )
}

export const loadCookiePreferences = (): CookiePreferences | null => {
  try {
    const storedPreferences = localStorage.getItem(
      COOKIE_PREFERENCES_STORAGE_KEY
    )

    if (!storedPreferences) {
      return null
    }

    const parsedPreferences: unknown = JSON.parse(storedPreferences)
    return isCookiePreferences(parsedPreferences) ? parsedPreferences : null
  } catch {
    return null
  }
}

export const saveCookiePreferences = (preferences: CookiePreferences) => {
  try {
    localStorage.setItem(
      COOKIE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences)
    )
  } catch {
    return false
  }

  return true
}
