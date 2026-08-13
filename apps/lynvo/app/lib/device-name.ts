import {
  getCurrentClientProfile,
  TVBRO_ANDROID_TV_PROFILE,
  type ClientProfile,
} from "~/lib/client-profile"

const detectBrowser = (userAgent: string) => {
  if (/SamsungBrowser\//i.test(userAgent)) {
    return "Samsung Internet"
  }
  if (/EdgA?\/|EdgiOS\/|Edge\//i.test(userAgent)) {
    return "Edge"
  }
  if (/OPR\/|Opera Mini\/|Opera Mobi\/|Opera\//i.test(userAgent)) {
    return "Opera"
  }
  if (/FxiOS\/|Firefox\//i.test(userAgent)) {
    return "Firefox"
  }
  if (/CriOS\//i.test(userAgent)) {
    return "Chrome"
  }
  if (/; wv\).*Version\/[\d.]+ Chrome\//i.test(userAgent)) {
    return "Android WebView"
  }
  if (/Chrome\/|Chromium\//i.test(userAgent)) {
    return "Chrome"
  }
  if (/MSIE\s|Trident\/.*rv:/i.test(userAgent)) {
    return "Internet Explorer"
  }
  if (/Version\/[\d.]+.*Safari\/|Safari\/.*Version\/[\d.]+/i.test(userAgent)) {
    return "Safari"
  }
  return "Browser"
}

const detectOperatingSystem = (userAgent: string) => {
  if (/Windows Phone/i.test(userAgent)) {
    return "Windows Phone"
  }
  if (/Android/i.test(userAgent)) {
    return "Android"
  }
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return "iOS"
  }
  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    return "macOS"
  }
  if (/CrOS/i.test(userAgent)) {
    return "ChromeOS"
  }
  if (/Windows/i.test(userAgent)) {
    return "Windows"
  }
  if (/KaiOS/i.test(userAgent)) {
    return "KaiOS"
  }
  if (/BlackBerry|BB10/i.test(userAgent)) {
    return "BlackBerry"
  }
  if (/Linux/i.test(userAgent)) {
    return "Linux"
  }
  return "device"
}

export const getBrowserDeviceName = (
  userAgent = globalThis.navigator === undefined ? "" : navigator.userAgent,
  clientProfile: ClientProfile | null = getCurrentClientProfile()
) => {
  if (clientProfile === TVBRO_ANDROID_TV_PROFILE) {
    return "TV Bro on Android TV"
  }
  if (!userAgent.trim()) {
    return "Unnamed device"
  }
  return `${detectBrowser(userAgent)} on ${detectOperatingSystem(userAgent)}`
}
