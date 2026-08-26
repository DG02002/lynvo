import type { ReactNode } from "react"
import { formatItemCount } from "~/lib/format-item-count"
import { cn } from "~/lib/utils"

export const MEDIA_LIST_ROW_TITLE_CLASS = "block text-sm md:text-lg"

export const SAVE_LIST_ROW_ENTER_ANIMATION_CLASS =
  "animate-in fade-in fill-mode-both slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"

export const MEDIA_LIST_ROW_MENU_CELL_CLASS = "w-16 shrink-0 text-foreground"

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

interface MediaListRowMetaProps {
  readonly sourceName: ReactNode
  readonly size?: string
  readonly itemCount?: number
}

export const MediaListRowMeta = ({
  sourceName,
  size,
  itemCount,
}: MediaListRowMetaProps) => (
  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
    <span className="min-w-0 truncate">{sourceName}</span>
    {Boolean(size) && (
      <span className="flex shrink-0 items-center gap-1.5">
        <span aria-hidden="true">·</span>
        <span>{size}</span>
      </span>
    )}
    {itemCount !== undefined && (
      <span className="flex shrink-0 items-center gap-1.5">
        <span aria-hidden="true">·</span>
        <span>{formatItemCount(itemCount)}</span>
      </span>
    )}
  </span>
)

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
  readonly overlayClassName?: string
  readonly buttonDataAttributes?: Readonly<Record<string, string | undefined>>
  readonly dataLayoutGuideTarget?: string
  readonly shouldStackIconOnMobile?: boolean
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
  overlayClassName,
  buttonDataAttributes,
  dataLayoutGuideTarget = "list-row",
  shouldStackIconOnMobile = false,
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
        shouldStackIconOnMobile &&
          "flex-col items-stretch gap-4 md:flex-row md:items-center",
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
          MEDIA_LIST_ROW_MENU_CELL_CLASS,
          overlayClassName,
          isOpened && !disabled && "bg-sky-500/15"
        )}
      >
        {overlay}
      </div>
    )}
  </div>
)
