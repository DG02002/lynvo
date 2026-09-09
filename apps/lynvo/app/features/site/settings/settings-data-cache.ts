export type SettingsDataKind = "usage" | "storage" | "player" | "security"

export const getSettingsDataCacheKey = (
  kind: SettingsDataKind,
  userId: string,
  variant?: string
): string =>
  ["settings", kind, userId, variant]
    .filter((part): part is string => Boolean(part))
    .join(":")

export const isSettingsDataCacheKeyForUser = (
  cacheKey: string,
  userId: string
): boolean => {
  const [namespace, , cacheUserId] = cacheKey.split(":")
  return namespace === "settings" && cacheUserId === userId
}
