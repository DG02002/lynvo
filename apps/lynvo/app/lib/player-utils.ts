export type PlayerId = "just" | "vlc" | "mpv" | "mx" | "mx-tv"
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
  {
    id: "mx-tv",
    name: "MX Player TV",
    packageName: "com.mxtech.videoplayer.television",
    iconUrl: "/icons/players/mx-tv.webp",
  },
] as const

export const DEFAULT_RANGE_PLAYER_ID: PlayerId = "just"
export const DEFAULT_NON_RANGE_PLAYER_ID: PlayerId = "vlc"

const RANGE_PLAYER_STORAGE_KEY = "lynvo:player:range-supported:v1"
const NON_RANGE_PLAYER_STORAGE_KEY = "lynvo:player:range-unsupported:v1"

const playerById = new Map(
  PLAYER_DEFINITIONS.map((player) => [player.id, player])
)

const isPlayerId = (value: unknown): value is PlayerId =>
  typeof value === "string" && playerById.has(value as PlayerId)

const getStoredPlayerId = (key: string, fallback: PlayerId): PlayerId => {
  if (typeof localStorage === "undefined") {
    return fallback
  }

  const stored = localStorage.getItem(key)
  return isPlayerId(stored) ? stored : fallback
}

const setStoredPlayerId = (key: string, playerId: PlayerId) => {
  if (typeof localStorage === "undefined") {
    return
  }

  localStorage.setItem(key, playerId)
}

export const getPlayerPreferences = () => ({
  rangeSupportedPlayerId: getStoredPlayerId(
    RANGE_PLAYER_STORAGE_KEY,
    DEFAULT_RANGE_PLAYER_ID
  ),
  rangeUnsupportedPlayerId: getStoredPlayerId(
    NON_RANGE_PLAYER_STORAGE_KEY,
    DEFAULT_NON_RANGE_PLAYER_ID
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

export const setRangeSupportedPlayer = (playerId: PlayerId) => {
  setStoredPlayerId(RANGE_PLAYER_STORAGE_KEY, playerId)
}

export const setRangeUnsupportedPlayer = (playerId: PlayerId) => {
  setStoredPlayerId(NON_RANGE_PLAYER_STORAGE_KEY, playerId)
}

export const selectPlayerForRangeCapability = (
  rangeRequest: RangeRequestCapability = "unknown"
): PlayerDefinition => {
  const preferences = getPlayerPreferences()
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
  options: { rangeRequest?: RangeRequestCapability } = {}
) => {
  const player = selectPlayerForRangeCapability(options.rangeRequest)
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

  if (
    typeof navigator !== "undefined" &&
    /android/i.test(navigator.userAgent)
  ) {
    launchIntentViaAnchor(intent)
  } else {
    window.open(targetUrl, "_blank", "noopener,noreferrer")
  }

  return { expectsNavigation: true, player }
}
