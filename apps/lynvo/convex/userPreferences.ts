const PLAYER_IDS = ["just", "vlc", "mpv", "mx", "mx-tv"]

export const normalizePlayerId = (playerId: string) => {
  if (!PLAYER_IDS.includes(playerId)) {
    throw new Error("Choose a supported player")
  }
  return playerId
}

export const buildPlayerPreferencesPatch = (preferences: {
  rangeSupportedPlayerId?: string
  rangeUnsupportedPlayerId?: string
}) => ({
  ...(preferences.rangeSupportedPlayerId !== undefined
    ? {
        rangeSupportedPlayerId: normalizePlayerId(
          preferences.rangeSupportedPlayerId
        ),
      }
    : {}),
  ...(preferences.rangeUnsupportedPlayerId !== undefined
    ? {
        rangeUnsupportedPlayerId: normalizePlayerId(
          preferences.rangeUnsupportedPlayerId
        ),
      }
    : {}),
})
