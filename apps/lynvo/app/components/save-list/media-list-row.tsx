import type { ReactNode } from "react"
import { cn } from "~/lib/utils"

export const MEDIA_LIST_ROW_TITLE_CLASS = "block text-sm md:text-lg"

export const SAVE_LIST_ROW_ENTER_ANIMATION_CLASS =
  "animate-in fade-in fill-mode-both slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"

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
  readonly overlayClassName?: string
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
  overlayClassName,
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
      "relative flex w-full items-center border-b last:border-b-0",
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
        "flex min-h-24 w-full cursor-pointer select-none items-center gap-3 px-4 py-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        !disabled && "hover:bg-muted",
        overlay && "pr-16",
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
          "absolute right-4 top-1/2 -translate-y-1/2",
          overlayClassName
        )}
      >
        {overlay}
      </div>
    )}
  </div>
)
