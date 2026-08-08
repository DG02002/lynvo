export const HOME_DEMO_STEP = {
  READY: 0,
  MOVE_TO_COPY_SOURCE: 1,
  COPY_SOURCE_LINK: 2,
  CLIPBOARD_VISIBLE: 3,
  PASTE_CLIPBOARD_LINK: 4,
  SAVING_LINK: 5,
  ITEM_CREATED: 6,
  OPEN_ITEM_MENU: 7,
  MOVE_TO_REMOVE_LINK: 8,
  REMOVE_LINK: 9,
  OPEN_REMOVE_DIALOG: 10,
  CONFIRM_REMOVE: 11,
  REMOVED: 12,
} as const

export const HOME_DEMO_FINAL_STEP = HOME_DEMO_STEP.REMOVED
export const HOME_DEMO_STEP_DELAYS_MS = [
  1_400, 1_200, 900, 1_600, 1_500, 2_000, 2_400, 1_800, 1_200, 1_000, 1_200,
  1_400, 1_800,
]
export const HOME_DEMO_CLIPBOARD_URL =
  "https://video.example/aurora-station-1080p.mp4"
export const HOME_DEMO_BROWSER_URL = "lynvo.dg02002.workers.dev/save"
export const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)"
export const HOME_DEMO_CURSOR_TIP_OFFSET_X_PX = 22
export const HOME_DEMO_CURSOR_TIP_OFFSET_Y_PX = 17
