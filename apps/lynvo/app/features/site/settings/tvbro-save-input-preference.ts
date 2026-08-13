import { useSyncExternalStore } from "react"
import {
  getCurrentClientProfile,
  TVBRO_ANDROID_TV_PROFILE,
} from "~/lib/client-profile"

export const TVBRO_SAVE_INPUT_STORAGE_KEY =
  "lynvo:settings:tvbro-hide-save-input"

const TVBRO_SAVE_INPUT_PREFERENCE_EVENT =
  "lynvo:tvbro-save-input-preference-changed"

const subscribeToTvBroSaveInputPreference = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(TVBRO_SAVE_INPUT_PREFERENCE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(TVBRO_SAVE_INPUT_PREFERENCE_EVENT, onStoreChange)
  }
}

export const getShouldHideTvBroSaveInput = () => {
  if (globalThis.localStorage === undefined) {
    return true
  }

  return localStorage.getItem(TVBRO_SAVE_INPUT_STORAGE_KEY) !== "false"
}

export const setShouldHideTvBroSaveInput = (shouldHide: boolean) => {
  localStorage.setItem(TVBRO_SAVE_INPUT_STORAGE_KEY, String(shouldHide))
  window.dispatchEvent(new Event(TVBRO_SAVE_INPUT_PREFERENCE_EVENT))
}

export const useShouldHideTvBroSaveInput = () =>
  useSyncExternalStore(
    subscribeToTvBroSaveInputPreference,
    getShouldHideTvBroSaveInput,
    () => true
  )

const getIsTvBroAndroidTv = () =>
  getCurrentClientProfile() === TVBRO_ANDROID_TV_PROFILE

const subscribeToClientProfile = () => () => undefined

export const useIsTvBroAndroidTv = () =>
  useSyncExternalStore(
    subscribeToClientProfile,
    getIsTvBroAndroidTv,
    () => false
  )

export const shouldHideSaveInput = (
  isTvBroAndroidTv: boolean,
  shouldHideTvBroSaveInput: boolean
) => isTvBroAndroidTv && shouldHideTvBroSaveInput
