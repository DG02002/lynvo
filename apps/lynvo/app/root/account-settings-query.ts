export const playerPreferencesQueryKey = (userId?: string) => [
  "settings",
  "player",
  userId ?? "signed-out",
]
