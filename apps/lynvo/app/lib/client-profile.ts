import {
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

// Keep this source static because it is embedded directly in an inline script
// tag. This avoids interpolating any value into executable JavaScript.
const DEVELOPMENT_CLIENT_PROFILE_BOOTSTRAP_SCRIPT = `(()=>{try{if(!("TVBro" in window)&&!(localStorage.getItem("lynvo:development:tvbro-ui")==="true"))return;document.documentElement.setAttribute("data-lynvo-client-profile","tvbro-android-tv")}catch{}})()`
const PRODUCTION_CLIENT_PROFILE_BOOTSTRAP_SCRIPT = `(()=>{try{if(!("TVBro" in window))return;document.documentElement.setAttribute("data-lynvo-client-profile","tvbro-android-tv")}catch{}})()`

export const CLIENT_PROFILE_BOOTSTRAP_SCRIPT = import.meta.env.DEV
  ? DEVELOPMENT_CLIENT_PROFILE_BOOTSTRAP_SCRIPT
  : PRODUCTION_CLIENT_PROFILE_BOOTSTRAP_SCRIPT
