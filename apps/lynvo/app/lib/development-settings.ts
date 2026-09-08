import { getCookieValueFromHeader } from "./auth-cookie"

export const DEVELOPMENT_TVBRO_UI_STORAGE_KEY = "lynvo:development:tvbro-ui"
export const DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY =
  "lynvo:development:freeze-usage"
export const DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME =
  "lynvo-development-freeze-usage"
export const DEVELOPMENT_SETTINGS_EVENT = "lynvo:development-settings-changed"
export const DEVELOPMENT_FREEZE_USAGE_BOOTSTRAP_SCRIPT = `(()=>{try{const stored=localStorage.getItem("lynvo:development:freeze-usage");const enabled=stored===null||stored==="true";document.cookie="lynvo-development-freeze-usage="+(enabled?"true":"false")+"; Path=/; Max-Age=31536000; SameSite=Lax"}catch{}})()`

const DEVELOPMENT_PREFERENCE_MAX_AGE_SECONDS = 31_536_000
const isDevelopmentBuild = import.meta.env.DEV

const readStorageBoolean = (key: string, defaultValue = false): boolean => {
  if (!isDevelopmentBuild) {
    return false
  }

  try {
    const storedValue = globalThis.localStorage?.getItem(key)
    return storedValue === null || storedValue === undefined
      ? defaultValue
      : storedValue === "true"
  } catch {
    return defaultValue
  }
}

const writeStorageBoolean = (key: string, value: boolean): void => {
  try {
    globalThis.localStorage?.setItem(key, String(value))
  } catch {
    // Local development preferences are best-effort when storage is blocked.
  }
}

const updateDevelopmentSetting = (update: () => void): void => {
  if (!isDevelopmentBuild) {
    return
  }

  update()
  if (globalThis.window !== undefined) {
    window.dispatchEvent(new Event(DEVELOPMENT_SETTINGS_EVENT))
  }
}

export const getDevelopmentTvBroUiEnabled = (): boolean =>
  readStorageBoolean(DEVELOPMENT_TVBRO_UI_STORAGE_KEY)

export const getDevelopmentFreezeUsageEnabled = (): boolean =>
  readStorageBoolean(DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY, true)

export const setDevelopmentTvBroUiEnabled = (enabled: boolean): void => {
  updateDevelopmentSetting(() =>
    writeStorageBoolean(DEVELOPMENT_TVBRO_UI_STORAGE_KEY, enabled)
  )
}

const writeFreezeUsageCookie = (enabled: boolean): void => {
  if (globalThis.document === undefined) {
    return
  }

  document.cookie = `${DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME}=${enabled ? "true" : "false"}; Path=/; Max-Age=${DEVELOPMENT_PREFERENCE_MAX_AGE_SECONDS}; SameSite=Lax`
}

export const setDevelopmentFreezeUsageEnabled = (enabled: boolean): void => {
  updateDevelopmentSetting(() => {
    writeStorageBoolean(DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY, enabled)
    writeFreezeUsageCookie(enabled)
  })
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

export const isDevelopmentFreezeUsageEnabled = (request: Request): boolean => {
  if (!isDevelopmentBuild) {
    return false
  }

  return (
    getCookieValueFromHeader(
      request.headers.get("Cookie"),
      DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME
    ) !== "false"
  )
}
