export const PLUGIN_SERVER_ID = "dev.lynvo.plugin-server"
export const PLUGIN_SERVER_NAME = "Lynvo Plugin Server"
export const BHADOO_SOURCE_ID = "bhadoo-google-drive-index"
export const BHADOO_SOURCE_IMPLEMENTATION_VERSION = "1.2.0"
export const BHADOO_FALLBACK_PATH = "/fallback"
export const BHADOO_FALLBACK_API_PATH = "/0:fallback"
export const GOOGLE_DRIVE_PUBLIC_FILES_SOURCE_ID = "google-drive-public-files"
export const ONEDRIVE_SOURCE_ID = "onedrive-index"
export const DIRECT_MEDIA_SOURCE_ID = "direct-media"
export const SOURCE_IMPLEMENTATION_VERSION = "1.1.0"
export const GLOBAL_DAILY_OPERATION_LIMIT = 20_000
export const USAGE_LIMITER_NAME = "global"
export const MILLISECONDS_PER_DAY = 86_400_000
export const MILLISECONDS_PER_SECOND = 1_000
export const MILLISECONDS_EPOCH_THRESHOLD = 1_000_000_000_000
export const USAGE_RESERVATION_LEASE_MS = 120_000
export const USAGE_RESERVATION_SETTLEMENT_GRACE_MS = 60_000
export const BYTES_PER_KIBIBYTE = 1024
export const FILE_SIZE_DECIMAL_PLACES = 2
export const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  "application/vnd.google-apps.folder"
export const BHADOO_REVERSE_ENVELOPE_PREFIX_CHARACTER_COUNT = 24
export const BHADOO_REVERSE_ENVELOPE_SUFFIX_CHARACTER_COUNT = 20
export const ONEDRIVE_FETCH_RETRIES = 3
export const ONEDRIVE_FETCH_RETRY_DELAY_MS = 2_000
export const UPSTREAM_TIMEOUT_MS = 10_000
export const EXTRACTION_ELAPSED_TIME_LIMIT_MS = 45_000
export const PAGINATION_PAGE_LIMIT = 100
export const EXTRACTION_NODE_LIMIT = 5_000
export const UPSTREAM_RESPONSE_BYTE_LIMIT = 2 * 1024 * 1024
export const UPSTREAM_REDIRECT_LIMIT = 3
export const DIRECT_MEDIA_RANGE_HEADER = "bytes=0-0"
export const DIRECT_MEDIA_CONTENT_TYPES = [
  "application/dash+xml",
  "application/mp4",
  "application/octet-stream",
  "application/ogg",
  "application/vnd.apple.mpegurl",
  "application/x-matroska",
  "application/x-mpegurl",
  "audio/",
  "binary/octet-stream",
  "video/",
]
export const DIRECT_MEDIA_BLOCKED_EXTENSIONS = [
  ".7z",
  ".apk",
  ".css",
  ".csv",
  ".doc",
  ".docx",
  ".exe",
  ".gif",
  ".html",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".md",
  ".pdf",
  ".png",
  ".rar",
  ".srt",
  ".svg",
  ".tar",
  ".txt",
  ".vtt",
  ".webp",
  ".xml",
  ".zip",
]
export const GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_HTML_BYTES = 2 * 1024 * 1024
export const GOOGLE_DRIVE_PUBLIC_FOLDER_MAX_ITEMS = 2_000
export const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^0\.0\.0\.0$/,
]
