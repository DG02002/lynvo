import { REALTIME_RECONNECT_FAILURE_WINDOW_MS } from "~/lib/constants"

export const REMOTE_POLL_INTERVAL_MS = 30_000
export const REMOTE_POLL_FAILURE_NOTICE_AFTER_MS =
  REALTIME_RECONNECT_FAILURE_WINDOW_MS
export const REMOTE_COMMAND_STALE_AFTER_MS = 5 * 60 * 1000
export const REMOTE_COMMAND_DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000
export const REMOTE_SESSION_ID_KEY = "lynvo_remote_session_id"
export const REMOTE_DEVICE_NAME_KEY = "lynvo_remote_device_name"
export const REMOTE_COMMAND_DELIVERY_KEY = "lynvo_remote_command_delivery_v1"
export const REMOTE_CONNECTION_FAILURE_MESSAGE =
  "Check the connection, then try again."
