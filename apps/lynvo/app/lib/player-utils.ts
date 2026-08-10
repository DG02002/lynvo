import { showPlayerLaunchError } from "~/lib/player-launch-events"

export type PlayerId = "just" | "vlc" | "mpv" | "mx"
export type RangeRequestCapability = "supported" | "unsupported" | "unknown"

export interface PlayerDefinition {
  id: PlayerId
  name: string
  packageName: string
  iconUrl: string
}

export const PLAYER_DEFINITIONS: readonly PlayerDefinition[] = [
  {
    id: "just",
    name: "Just (Video) Player",
    packageName: "com.brouken.player",
    iconUrl: "/icons/players/just.webp",
  },
  {
    id: "vlc",
    name: "VLC for Android",
    packageName: "org.videolan.vlc",
    iconUrl: "/icons/players/vlc.webp",
  },
  {
    id: "mpv",
    name: "MPV",
    packageName: "is.xyz.mpv",
    iconUrl: "/icons/players/mpv.webp",
  },
  {
    id: "mx",
    name: "MX Player",
    packageName: "com.mxtech.videoplayer.ad",
    iconUrl: "/icons/players/mx.webp",
  },
] as const

export const DEFAULT_RANGE_PLAYER_ID: PlayerId = "just"
export const DEFAULT_NON_RANGE_PLAYER_ID: PlayerId = "vlc"

const RANGE_PLAYER_STORAGE_KEY = "lynvo:player:range-supported:v1"
const NON_RANGE_PLAYER_STORAGE_KEY = "lynvo:player:range-unsupported:v1"

const scopedPlayerKey = (key: string, userId?: string) =>
  userId ? `${key}:${userId}` : undefined

const playerById = new Map(
  PLAYER_DEFINITIONS.map((player) => [player.id, player])
)

const isPlayerId = (value: unknown): value is PlayerId =>
  typeof value === "string" && playerById.has(value as PlayerId)

const getStoredPlayerId = (
  key: string,
  fallback: PlayerId,
  userId?: string
): PlayerId => {
  if (typeof localStorage === "undefined") {
    return fallback
  }

  const scopedKey = scopedPlayerKey(key, userId)
  if (!scopedKey) {
    return fallback
  }
  const stored = localStorage.getItem(scopedKey)
  return isPlayerId(stored) ? stored : fallback
}

const setStoredPlayerId = (
  key: string,
  playerId: PlayerId,
  userId?: string
) => {
  if (typeof localStorage === "undefined") {
    return
  }

  const scopedKey = scopedPlayerKey(key, userId)
  if (scopedKey) {
    localStorage.setItem(scopedKey, playerId)
  }
}

export const getPlayerPreferences = (userId?: string) => ({
  rangeSupportedPlayerId: getStoredPlayerId(
    RANGE_PLAYER_STORAGE_KEY,
    DEFAULT_RANGE_PLAYER_ID,
    userId
  ),
  rangeUnsupportedPlayerId: getStoredPlayerId(
    NON_RANGE_PLAYER_STORAGE_KEY,
    DEFAULT_NON_RANGE_PLAYER_ID,
    userId
  ),
})

export const normalizePlayerPreferences = (preferences: {
  rangeSupportedPlayerId?: unknown
  rangeUnsupportedPlayerId?: unknown
}) => ({
  rangeSupportedPlayerId: isPlayerId(preferences.rangeSupportedPlayerId)
    ? preferences.rangeSupportedPlayerId
    : DEFAULT_RANGE_PLAYER_ID,
  rangeUnsupportedPlayerId: isPlayerId(preferences.rangeUnsupportedPlayerId)
    ? preferences.rangeUnsupportedPlayerId
    : DEFAULT_NON_RANGE_PLAYER_ID,
})

export const setRangeSupportedPlayer = (userId: string, playerId: PlayerId) => {
  setStoredPlayerId(RANGE_PLAYER_STORAGE_KEY, playerId, userId)
}

export const setRangeUnsupportedPlayer = (
  userId: string,
  playerId: PlayerId
) => {
  setStoredPlayerId(NON_RANGE_PLAYER_STORAGE_KEY, playerId, userId)
}

export const selectPlayerForRangeCapability = (
  rangeRequest: RangeRequestCapability = "unknown",
  userId?: string
): PlayerDefinition => {
  const preferences = getPlayerPreferences(userId)
  const playerId =
    rangeRequest === "unsupported"
      ? preferences.rangeUnsupportedPlayerId
      : preferences.rangeSupportedPlayerId

  return playerById.get(playerId) ?? playerById.get(DEFAULT_RANGE_PLAYER_ID)!
}

export const buildIntentUrl = (mediaUrl: string, player: PlayerDefinition) => {
  try {
    const u = new URL(mediaUrl)
    const scheme = u.protocol.replace(":", "")
    const host = u.host
    const path = u.pathname || "/"
    const query = u.search || ""
    return (
      "intent://" +
      host +
      path +
      query +
      "#Intent;scheme=" +
      scheme +
      ";action=android.intent.action.VIEW;type=video/*;package=" +
      player.packageName +
      ";end"
    )
  } catch {
    return (
      "intent:" +
      mediaUrl +
      "#Intent;action=android.intent.action.VIEW;type=video/*;package=" +
      player.packageName +
      ";end"
    )
  }
}

export const openInPlayer = async (
  targetUrl: string,
  options: { rangeRequest?: RangeRequestCapability; userId?: string } = {}
) => {
  const player = selectPlayerForRangeCapability(
    options.rangeRequest,
    options.userId
  )
  return openInSpecificPlayer(targetUrl, player)
}

export const openInSpecificPlayer = async (
  targetUrl: string,
  player: PlayerDefinition
) => {
  const intent = buildIntentUrl(targetUrl, player)

  const visHandler = () => {
    if (document.visibilityState === "hidden") {
      document.removeEventListener("visibilitychange", visHandler)
    }
  }
  document.addEventListener("visibilitychange", visHandler)

  const launchIntentViaAnchor = (intentUrl: string) => {
    try {
      const a = document.createElement("a")
      a.href = intentUrl
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
      return false
    }
    return true
  }

  const isAndroid =
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)

  if (!isAndroid || !launchIntentViaAnchor(intent)) {
    document.removeEventListener("visibilitychange", visHandler)
    showPlayerLaunchError(player.name, player.iconUrl)
    return { expectsNavigation: false, player }
  }

  return { expectsNavigation: true, player }
}
