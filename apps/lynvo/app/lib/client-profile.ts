export const LEGACY_TVBRO_MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/84.0.4147.89 Mobile Safari/537.36"

export const TVBRO_ANDROID_TV_PROFILE = "tvbro-android-tv"
export const CLIENT_PROFILE_ATTRIBUTE = "data-lynvo-client-profile"

export type ClientProfile = typeof TVBRO_ANDROID_TV_PROFILE

export const getClientProfile = ({
  userAgent,
  hasTvBroBridge,
}: {
  userAgent: string
  hasTvBroBridge: boolean
}): ClientProfile | null =>
  hasTvBroBridge && userAgent === LEGACY_TVBRO_MOBILE_USER_AGENT
    ? TVBRO_ANDROID_TV_PROFILE
    : null

const hasTvBroBridge = () =>
  globalThis.window !== undefined && "TVBro" in window

export const getCurrentClientProfile = (
  userAgent = globalThis.navigator === undefined ? "" : navigator.userAgent
) => getClientProfile({ userAgent, hasTvBroBridge: hasTvBroBridge() })

export const CLIENT_PROFILE_BOOTSTRAP_SCRIPT = `(()=>{try{if("TVBro"in window&&navigator.userAgent===${JSON.stringify(LEGACY_TVBRO_MOBILE_USER_AGENT)})document.documentElement.setAttribute(${JSON.stringify(CLIENT_PROFILE_ATTRIBUTE)},${JSON.stringify(TVBRO_ANDROID_TV_PROFILE)})}catch{}})()`
