export const DAY_MS = 1000 * 60 * 60 * 24
export const ACCOUNT_INACTIVITY_LIMIT_MS = DAY_MS * 90
export const SESSION_TOTAL_DURATION_MS = DAY_MS * 365
export const USER_STORAGE_LIMIT_BYTES = 3 * 1024 * 1024
export const USER_STORAGE_WARNING_BYTES = Math.round(2.4 * 1024 * 1024)
export const RECENT_LINK_LIMIT_BYTES = 1024 * 1024
export const DEFAULT_RETENTION_DAYS = 90
export const MAX_RETENTION_DAYS = 180
export const STORAGE_RETENTION_DAY_OPTIONS = [7, 30, 90, 180]
export const ACTIVITY_UPDATE_INTERVAL_MS = DAY_MS * 7
export const INACTIVE_ACCOUNT_CLEANUP_BATCH_SIZE = 10
export const USER_DAILY_OFFICIAL_EXTRACTION_LIMIT = 100
export const GLOBAL_DAILY_OFFICIAL_EXTRACTION_LIMIT = 20_000
export const REMOTE_COMMAND_TTL_MS = 5 * 60 * 1000
export const REMOTE_COMMAND_MAX_PAYLOAD_BYTES = 16 * 1024
export const REMOTE_COMMAND_QUERY_LIMIT = 100
export const REMOTE_COMMAND_CLEANUP_BATCH_SIZE = 100
export const DEVICE_CODE_TTL_MS = 10 * 60 * 1000
export const DEVICE_CODE_PREFLIGHT_TTL_MS = 2 * 60 * 1000
export const DEVICE_CODE_CLEANUP_BATCH_SIZE = 100
export const DEVICE_CODE_CREATION_RATE_LIMIT = 5
export const DEVICE_CODE_CREATION_RATE_WINDOW_SECONDS = 10 * 60
export const OFFICIAL_PLUGIN_MONTHLY_EXTRACTION_LIMITS = {
  "bhadoo-google-drive-index": 50,
  "onedrive-index": 50,
  direct: 200,
} as const
export const OFFICIAL_PLUGIN_DISPLAY_NAMES = {
  "bhadoo-google-drive-index": "Bhadoo’s Google Drive Index",
  "onedrive-index": "OneDrive Index",
  direct: "Direct links",
} as const
