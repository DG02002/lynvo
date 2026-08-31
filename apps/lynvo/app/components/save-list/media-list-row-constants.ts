import { cn } from "~/lib/utils"

export const MEDIA_LIST_ROW_TITLE_CLASS = "block text-sm md:text-lg"

export const MEDIA_LIST_ROW_META_CLASS =
  "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground"

export const SAVE_LIST_ROW_ENTER_ANIMATION_CLASS =
  "animate-in fade-in fill-mode-both slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"

export const MEDIA_LIST_ROW_MENU_CELL_CLASS = "w-16 shrink-0 text-foreground"

// The immersive header's episode toggle is an optional auto-sized column, so
// the menu cell must pin itself to the trailing column to stay right-aligned
// when no toggle is rendered.
export const MEDIA_LIST_HEADER_MENU_CELL_CLASS = cn(
  "flex self-stretch items-center justify-center col-start-4",
  MEDIA_LIST_ROW_MENU_CELL_CLASS
)

const MEDIA_LIST_MENU_ICON_CLASS = "[&_svg]:size-7!"

export const MEDIA_LIST_ROW_MENU_TRIGGER_CLASS = cn(
  "size-full! rounded-none! bg-transparent text-foreground shadow-none hover:bg-muted aria-expanded:bg-muted dark:hover:bg-muted/50",
  MEDIA_LIST_MENU_ICON_CLASS
)
