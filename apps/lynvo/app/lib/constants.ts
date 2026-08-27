export const REALTIME_SESSION_REVOKED_CLOSE_CODE = 4001
export const PLUGIN_SERVER_INTERNAL_ORIGIN = "https://plugin-server.internal"
export const PLUGIN_SERVER_REQUEST_TIMEOUT_MS = 50_000
export const OUTBOUND_HTTP_MAX_REDIRECTS = 3
export const OUTBOUND_HTTP_MAX_RESPONSE_BYTES = 5 * 1024 * 1024
export const OUTBOUND_HTTP_TIMEOUT_MS = 15_000
export const LYNVO_PLUGIN_SERVER_ID = "lynvo:dev.lynvo.plugin-server"
export const DOCS_SCROLL_OFFSET_PX = 112
export const DOCS_SCROLL_END_TOLERANCE_PX = 2
export const DEVICE_AUTH_STATUS_POLL_INTERVAL_MS = 2_000
export const VERSION_WATCH_INTERVAL_MS = 60_000
export const LINKS_REFETCH_DEBOUNCE_MS = 50
export const LINKS_OFFLINE_POLL_INTERVAL_MS = 25_000
export const SAVE_LIST_OLDER_AFTER_DAY_COUNT = 7
export const DATA_VERSION_RESPONSE_HEADER = "X-Lynvo-Data-Version"
export const MEDIA_ARTWORK_API_TIMEOUT_MS = 15_000
export const MEDIA_ARTWORK_BATCH_SIZE = 12
export const MEDIA_ARTWORK_FLUSH_DELAY_MS = 150
export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p"
export const MILLISECONDS_PER_SECOND = 1_000
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * MILLISECONDS_PER_SECOND
export const TMDB_IMAGE_CARD_BASE_URL = "https://image.tmdb.org/t/p/w342"
export const TMDB_IMAGE_CARD_PREVIEW_BASE_URL = "https://image.tmdb.org/t/p/w92"
export const TMDB_IMAGE_DETAIL_BASE_URL = "https://image.tmdb.org/t/p/w780"
export const TMDB_IMAGE_DETAIL_PREVIEW_BASE_URL =
  "https://image.tmdb.org/t/p/w342"
export const TMDB_IMAGE_WIDE_CARD_BASE_URL = TMDB_IMAGE_DETAIL_BASE_URL
export const TMDB_IMAGE_WIDE_CARD_PREVIEW_BASE_URL =
  TMDB_IMAGE_DETAIL_PREVIEW_BASE_URL
export const TMDB_POSTER_SRC_WIDTHS_PX = [342, 500, 780] as const
export const TMDB_STILL_SRC_WIDTHS_PX = [300, 780, 1280] as const
export const MEDIA_ARTWORK_CACHE_STORAGE_PREFIX = "lynvo:media-artwork:v1:"
export const MEDIA_ARTWORK_FOUND_TTL_MS = 30 * MILLISECONDS_PER_DAY
export const MEDIA_ARTWORK_NOT_FOUND_TTL_MS = MILLISECONDS_PER_DAY
export const TMDB_ATTRIBUTION_LOGO_SRC = "/images/tmdb-attribution.svg"
export const SAVE_GRID_CARD_SHIFT_DURATION_MS = 300
export const EXTRACTION_STATUS_ROTATION_INTERVAL_MS = 2_400
export const EXTRACTION_STATUS_MESSAGES = [
  "Getting link info…",
  "Extracting links…",
  "Finding playable links…",
  "Getting things ready…",
  "Following the link trail…",
  "Asking the internet nicely…",
  "Checking promising routes…",
  "Looking for playable links…",
  "Checking whether this link has friends…",
  "Sorting the useful bits…",
  "Doing a little link detective work…",
  "Giving the metadata a gentle nudge…",
  "Putting the pieces together…",
  "Finishing link details…",
  "Polishing the final details…",
  "Wrapping up link extraction…",
] as const
export const EXTRACTION_COMPLETE_DISPLAY_MS = 2_400
export const EXTRACTION_COMPLETE_FADE_OUT_MS = 400
export const EXTRACTION_COMPLETE_MESSAGES = [
  "Done and dusted.",
  "Links found. You’re welcome.",
  "Fresh links, still warm.",
  "That went surprisingly well.",
  "All wrapped up.",
  "Nailed it.",
  "Links acquired. Enjoy.",
  "Sorted. Easy.",
  "Mission accomplished.",
  "The internet delivered.",
] as const
export const FINDER_NAVIGATION_GESTURE_TRIGGER_DISTANCE_PX = 32
export const FINDER_NAVIGATION_GESTURE_RESET_DELAY_MS = 160
export const MOBILE_PRICING_CONTROLS_HEIGHT_PX = 112
export const MEDIA_FILENAME_MAX_EPISODE_DIGITS = 4
export const MEDIA_YEAR_MIN = 1900
export const MEDIA_YEAR_MAX = 2099
