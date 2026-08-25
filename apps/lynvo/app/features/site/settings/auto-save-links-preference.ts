import { useSyncExternalStore } from "react"

const subscribeToAutoSaveLinksPreference = () => () => undefined

export const getShouldAutoSaveAllLinks = (): boolean => true

export const useShouldAutoSaveAllLinks = () =>
  useSyncExternalStore(
    subscribeToAutoSaveLinksPreference,
    getShouldAutoSaveAllLinks,
    () => true
  )
