import type { ReactNode } from "react"
import { cn } from "~/lib/utils"

export const MEDIA_LIST_ROW_TITLE_CLASS = "block text-sm md:text-lg"

export const SAVE_LIST_ROW_ENTER_ANIMATION_CLASS =
  "animate-in fade-in fill-mode-both slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"

export const MEDIA_LIST_ROW_MENU_CELL_CLASS =
  "w-16 shrink-0 border-s border-border/70"

export const MEDIA_LIST_HEADER_MENU_CELL_CLASS = cn(
  "contents md:flex md:h-full md:items-center md:justify-center",
  MEDIA_LIST_ROW_MENU_CELL_CLASS
)

const MEDIA_LIST_MENU_ICON_CLASS = "[&_svg]:size-7!"

export const MEDIA_LIST_ROW_MENU_TRIGGER_CLASS = cn(
  "size-full! rounded-none! bg-transparent text-foreground shadow-none hover:bg-muted aria-expanded:bg-muted dark:hover:bg-muted/50",
  MEDIA_LIST_MENU_ICON_CLASS
)

interface SaveListRowIconProps {
  readonly children: ReactNode
  readonly className?: string
}

export const SaveListRowIcon = ({
  children,
  className,
}: SaveListRowIconProps) => (
  <span
    className={cn(
      "flex size-10 shrink-0 items-center justify-center text-foreground md:size-14",
      className
    )}
  >
    {children}
  </span>
)

interface MediaListRowProps {
  readonly label?: string
  readonly icon: ReactNode
  readonly title: ReactNode
  readonly meta?: ReactNode
  readonly trailing?: ReactNode
  readonly overlay?: ReactNode
  readonly onActivate: () => void
  readonly disabled?: boolean
  readonly isOpened?: boolean
  readonly wrapperClassName?: string
  readonly buttonClassName?: string
  readonly buttonDataAttributes?: Readonly<Record<string, string | undefined>>
  readonly dataLayoutGuideTarget?: string
}

export const MediaListRow = ({
  label,
  icon,
  title,
  meta,
  trailing,
  overlay,
  onActivate,
  disabled = false,
  isOpened = false,
  wrapperClassName,
  buttonClassName,
  buttonDataAttributes,
  dataLayoutGuideTarget = "list-row",
}: MediaListRowProps) => (
  <div
    className={cn(
      "flex w-full items-stretch border-b last:border-b-0",
      SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
      wrapperClassName
    )}
    data-layout-guide-target={dataLayoutGuideTarget}
  >
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        "flex min-h-24 min-w-0 flex-1 cursor-pointer select-none items-center gap-3 px-4 py-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        !disabled && "hover:bg-muted",
        isOpened && !disabled && "bg-sky-500/15 hover:bg-sky-500/20",
        disabled && "cursor-not-allowed opacity-60",
        buttonClassName
      )}
      onClick={onActivate}
      {...buttonDataAttributes}
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        {title}
        {meta}
      </span>
      {trailing}
    </button>
    {overlay && (
      <div
        className={cn(
          "flex items-center justify-center",
          MEDIA_LIST_ROW_MENU_CELL_CLASS
        )}
      >
        {overlay}
      </div>
    )}
  </div>
)
