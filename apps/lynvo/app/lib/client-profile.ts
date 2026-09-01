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
  getClientProfile({ hasTvBroBridge: hasTvBroBridge() })

export const CLIENT_PROFILE_BOOTSTRAP_SCRIPT =
  '(()=>{try{if(!("TVBro"in window))return;document.documentElement.setAttribute("data-lynvo-client-profile","tvbro-android-tv")}catch{}})()'
