export const DEVELOPMENT_TVBRO_UI_STORAGE_KEY = "lynvo:development:tvbro-ui"
export const DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY =
  "lynvo:development:freeze-usage"
export const DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME =
  "lynvo-development-freeze-usage"
export const DEVELOPMENT_SETTINGS_EVENT = "lynvo:development-settings-changed"

const DEVELOPMENT_PREFERENCE_MAX_AGE_SECONDS = 31_536_000

const readStorageBoolean = (key: string): boolean => {
  if (!import.meta.env.DEV) {
    return false
  }

  try {
    return globalThis.localStorage?.getItem(key) === "true"
  } catch {
    return false
  }
}

const writeStorageBoolean = (key: string, value: boolean): void => {
  if (!import.meta.env.DEV) {
    return
  }

  try {
    globalThis.localStorage?.setItem(key, String(value))
  } catch {
    // Local development preferences are best-effort when storage is blocked.
  }
}

const notifyDevelopmentSettingsChanged = (): void => {
  if (globalThis.window !== undefined) {
    window.dispatchEvent(new Event(DEVELOPMENT_SETTINGS_EVENT))
  }
}

export const getDevelopmentTvBroUiEnabled = (): boolean =>
  readStorageBoolean(DEVELOPMENT_TVBRO_UI_STORAGE_KEY)

export const getDevelopmentFreezeUsageEnabled = (): boolean =>
  readStorageBoolean(DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY)

export const setDevelopmentTvBroUiEnabled = (enabled: boolean): void => {
  if (!import.meta.env.DEV) {
    return
  }
  writeStorageBoolean(DEVELOPMENT_TVBRO_UI_STORAGE_KEY, enabled)
  notifyDevelopmentSettingsChanged()
}

const writeFreezeUsageCookie = (enabled: boolean): void => {
  if (!import.meta.env.DEV || globalThis.document === undefined) {
    return
  }

  document.cookie = `${DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME}=${enabled ? "true" : ""}; Path=/; Max-Age=${enabled ? DEVELOPMENT_PREFERENCE_MAX_AGE_SECONDS : 0}; SameSite=Lax`
}

export const setDevelopmentFreezeUsageEnabled = (enabled: boolean): void => {
  if (!import.meta.env.DEV) {
    return
  }
  writeStorageBoolean(DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY, enabled)
  writeFreezeUsageCookie(enabled)
  notifyDevelopmentSettingsChanged()
}

export const subscribeToDevelopmentSettings = (
  onStoreChange: () => void
): (() => void) => {
  if (globalThis.window === undefined) {
    return () => undefined
  }

  window.addEventListener("storage", onStoreChange)
  window.addEventListener(DEVELOPMENT_SETTINGS_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(DEVELOPMENT_SETTINGS_EVENT, onStoreChange)
  }
}

const getCookieValue = (
  cookieHeader: string | null,
  cookieName: string
): string | undefined => {
  const cookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))

  return cookie?.slice(cookieName.length + 1)
}

export const isDevelopmentFreezeUsageEnabled = (request: Request): boolean =>
  import.meta.env.DEV &&
  getCookieValue(
    request.headers.get("Cookie"),
    DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME
  ) === "true"
