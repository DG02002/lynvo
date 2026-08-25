import { useSyncExternalStore } from "react"
import {
  getCurrentClientProfile,
  TVBRO_ANDROID_TV_PROFILE,
} from "~/lib/client-profile"

const subscribeToTvBroSaveInputPreference = () => () => undefined

export const getShouldHideTvBroSaveInput = (): boolean => true

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
