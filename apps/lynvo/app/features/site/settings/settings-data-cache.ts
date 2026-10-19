import { clearAsyncResourceCacheWhere } from "~/hooks/use-async-resource"

export type SettingsDataKind = "usage" | "storage" | "player" | "security"

export const getSettingsDataCacheKey = (
  kind: SettingsDataKind,
  userId: string,
  variant?: string
): string =>
  ["settings", kind, userId, variant]
    .filter((part): part is string => Boolean(part))
    .join(":")

const isSettingsDataCacheKeyForUser = (
  cacheKey: string,
  userId: string
): boolean => {
  const [namespace, , cacheUserId] = cacheKey.split(":")
  return namespace === "settings" && cacheUserId === userId
}

export const clearSettingsDataCacheForUser = (userId: string): void => {
  clearAsyncResourceCacheWhere((cacheKey) =>
    isSettingsDataCacheKeyForUser(cacheKey, userId)
  )
}
