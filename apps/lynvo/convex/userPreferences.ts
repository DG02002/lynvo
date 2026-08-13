const PLAYER_IDS = ["just", "vlc", "mpv", "mx"]

interface PlayerPreferencesPatch {
  rangeSupportedPlayerId?: string
  rangeUnsupportedPlayerId?: string
}

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
}) => {
  const patch: PlayerPreferencesPatch = {}
  if (preferences.rangeSupportedPlayerId !== undefined) {
    patch.rangeSupportedPlayerId = normalizePlayerId(
      preferences.rangeSupportedPlayerId
    )
  }
  if (preferences.rangeUnsupportedPlayerId !== undefined) {
    patch.rangeUnsupportedPlayerId = normalizePlayerId(
      preferences.rangeUnsupportedPlayerId
    )
  }
  return patch
}
