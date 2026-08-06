const PLAYER_IDS = ["just", "vlc", "mpv", "mx"]

export const normalizePlayerId = (playerId: string) => {
  if (!PLAYER_IDS.includes(playerId)) {
    throw new Error(
      "Choose Just (Video) Player, VLC for Android, MPV, or MX Player"
    )
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
