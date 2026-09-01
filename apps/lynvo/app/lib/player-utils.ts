import { Result, Schema } from "effect"
import { showPlayerLaunchError } from "~/lib/player-launch-events"

export type PlayerId = "just" | "vlc" | "mpv" | "mx"
export type RangeRequestCapability = "supported" | "unsupported" | "unknown"

export const playerIdSchema = Schema.Literals(["just", "vlc", "mpv", "mx"])

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
    name: "VLC",
    packageName: "org.videolan.vlc",
    iconUrl: "/icons/players/vlc.webp",
  },
  {
    id: "mpv",
    name: "mpv",
    packageName: "is.xyz.mpv",
    iconUrl: "/icons/players/mpv.webp",
  },
  {
    id: "mx",
    name: "MX Player",
    packageName: "com.mxtech.videoplayer.ad",
    iconUrl: "/icons/players/mx.webp",
  },
]

export const DEFAULT_RANGE_PLAYER_ID: PlayerId = "just"
export const DEFAULT_NON_RANGE_PLAYER_ID: PlayerId = "vlc"

const RANGE_PLAYER_STORAGE_KEY = "lynvo:player:range-supported:v1"
const NON_RANGE_PLAYER_STORAGE_KEY = "lynvo:player:range-unsupported:v1"

const scopedPlayerKey = (key: string, userId?: string) =>
  userId ? `${key}:${userId}` : undefined

const playerById = new Map(
  PLAYER_DEFINITIONS.map((player) => [player.id, player])
)

export const isPlayerId = <Value>(value: Value): value is Value & PlayerId =>
  Result.isSuccess(Schema.decodeUnknownResult(playerIdSchema)(value))

const getStoredPlayerId = (
  key: string,
  fallback: PlayerId,
  userId?: string
): PlayerId => {
  if (globalThis.localStorage === undefined) {
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
  if (globalThis.localStorage === undefined) {
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

  const player =
    playerById.get(playerId) ?? playerById.get(DEFAULT_RANGE_PLAYER_ID)
  if (!player) {
    throw new Error("Default player configuration is missing")
  }
  return player
}

export const buildIntentUrl = (mediaUrl: string, player: PlayerDefinition) => {
  try {
    const { protocol, host, pathname, search } = new URL(mediaUrl)
    const scheme = protocol.replace(":", "")
    const path = pathname || "/"
    const query = search || ""
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

const createPlayerVisibilityChangeHandler = (): (() => void) => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }
  return handleVisibilityChange
}

const launchIntentViaAnchor = (intentUrl: string): boolean => {
  try {
    const anchor = document.createElement("a")
    anchor.href = intentUrl
    anchor.style.display = "none"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } catch {
    return false
  }
  return true
}

export const openInSpecificPlayer = async (
  targetUrl: string,
  player: PlayerDefinition
) => {
  const intent = buildIntentUrl(targetUrl, player)
  const visibilityChangeHandler = createPlayerVisibilityChangeHandler()

  document.addEventListener("visibilitychange", visibilityChangeHandler)

  const isAndroid =
    globalThis.navigator !== undefined && /android/i.test(navigator.userAgent)

  if (!isAndroid || !launchIntentViaAnchor(intent)) {
    document.removeEventListener("visibilitychange", visibilityChangeHandler)
    showPlayerLaunchError(player.name, player.iconUrl)
    return { expectsNavigation: false, player }
  }

  return { expectsNavigation: true, player }
}
