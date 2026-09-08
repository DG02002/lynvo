import {
  DEVELOPMENT_TVBRO_UI_STORAGE_KEY,
  getDevelopmentTvBroUiEnabled,
  subscribeToDevelopmentSettings,
} from "./development-settings"

export const TVBRO_ANDROID_TV_PROFILE = "tvbro-android-tv"
export const CLIENT_PROFILE_ATTRIBUTE = "data-lynvo-client-profile"

export type ClientProfile = typeof TVBRO_ANDROID_TV_PROFILE

export const getClientProfile = ({
  hasTvBroBridge,
}: {
  hasTvBroBridge: boolean
}): ClientProfile | null => (hasTvBroBridge ? TVBRO_ANDROID_TV_PROFILE : null)

const hasTvBroBridge = () =>
  globalThis.window !== undefined && "TVBro" in window

export const getCurrentClientProfile = () =>
  getClientProfile({
    hasTvBroBridge: hasTvBroBridge() || getDevelopmentTvBroUiEnabled(),
  })

export const subscribeToClientProfile = (onStoreChange: () => void) =>
  subscribeToDevelopmentSettings(onStoreChange)

export const syncClientProfileAttribute = (): void => {
  if (globalThis.document === undefined) {
    return
  }

  const profile = getCurrentClientProfile()
  if (profile) {
    document.documentElement.setAttribute(CLIENT_PROFILE_ATTRIBUTE, profile)
  } else {
    document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)
  }
}

const tvBroUiOverrideExpression = import.meta.env.DEV
  ? `localStorage.getItem(${JSON.stringify(DEVELOPMENT_TVBRO_UI_STORAGE_KEY)}) === "true"`
  : "false"

export const CLIENT_PROFILE_BOOTSTRAP_SCRIPT = `(()=>{try{if(!("TVBro"in window)&&!(${tvBroUiOverrideExpression}))return;document.documentElement.setAttribute("${CLIENT_PROFILE_ATTRIBUTE}","${TVBRO_ANDROID_TV_PROFILE}")}catch{}})()`
