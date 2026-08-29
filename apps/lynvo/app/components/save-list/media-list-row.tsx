import type { ReactNode } from "react"
import { formatItemCount } from "~/lib/format-item-count"
import { cn } from "~/lib/utils"
import {
  MEDIA_LIST_ROW_MENU_CELL_CLASS,
  SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
} from "./media-list-row-constants"

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
  shouldStackIconOnMobile = false,
}: MediaListRowProps) => {
  if (shouldStackIconOnMobile) {
    return (
      <div
        className={cn(
          "relative flex flex-col border-b last:border-b-0 md:flex-row md:items-stretch",
          SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
          wrapperClassName
        )}
        {...buttonDataAttributes}
      >
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          className={cn(
            "absolute inset-0 z-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            !disabled && "hover:bg-muted",
            isOpened && !disabled && "bg-sky-500/15 hover:bg-sky-500/20",
            disabled && "cursor-not-allowed",
            buttonClassName
          )}
          onClick={onActivate}
        />
        <div
          className={cn(
            "pointer-events-none relative z-2 flex min-h-24 flex-1 flex-col gap-3 p-3 md:flex-row md:items-center md:gap-3 md:p-0 md:px-4 md:py-6",
            disabled && "opacity-60"
          )}
        >
          {icon}
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <span className="flex min-w-0 items-center gap-3">
              <span className="min-w-0 flex-1">{title}</span>
              {overlay && (
                <span className="pointer-events-auto -me-1 shrink-0 md:hidden">
                  {overlay}
                </span>
              )}
            </span>
            {meta}
          </span>
          {trailing}
        </div>
        {overlay && (
          <div
            className={cn(
              "relative z-2 hidden items-center justify-center md:flex",
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
  }

  return (
    <div
      className={cn(
        "flex w-full items-stretch border-b last:border-b-0",
        SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
        wrapperClassName
      )}
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
}
