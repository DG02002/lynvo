export const EXTRACTOR_ID = "dev.lynvo.official-extractor"
export const EXTRACTOR_NAME = "Lynvo Official Extractor"
export const BHADOO_SOURCE_ID = "bhadoo-google-drive-index"
export const ONEDRIVE_SOURCE_ID = "onedrive-index"
export const SOURCE_IMPLEMENTATION_VERSION = "1.0.0"
export const GLOBAL_DAILY_OPERATION_LIMIT = 20_000
export const USAGE_LIMITER_NAME = "global"
export const MILLISECONDS_PER_DAY = 86_400_000
export const BYTES_PER_KIBIBYTE = 1024
export const FILE_SIZE_DECIMAL_PLACES = 2
export const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  "application/vnd.google-apps.folder"
export const LEGACY_RESPONSE_PREFIX_LENGTH = 24
export const LEGACY_RESPONSE_SUFFIX_LENGTH = 20
export const ONEDRIVE_FETCH_RETRIES = 3
export const ONEDRIVE_FETCH_RETRY_DELAY_MS = 2_000
export const UPSTREAM_TIMEOUT_MS = 10_000
export const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^0\.0\.0\.0$/,
]
