import type { ReactNode } from "react"
import { ExpandableFilename } from "~/components/expandable-filename"
import { formatItemCount } from "~/lib/format-item-count"
import { cn } from "~/lib/utils"
import { ExtractionStatusTitle } from "./extraction-status"
import type { ExtractionStatusTitleSpec } from "./extraction-status-utils"
import {
  MEDIA_LIST_ROW_HOVER_TINT_CLASS,
  MEDIA_LIST_ROW_MENU_CELL_CLASS,
  MEDIA_LIST_ROW_META_CLASS,
  MEDIA_LIST_ROW_OPENED_TINT_CLASS,
  MEDIA_LIST_ROW_TITLE_CLASS,
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

interface MediaListRowTitleText {
  readonly value: string
  readonly isStruckThrough?: boolean
}

interface MediaListRowProps {
  readonly label?: string
  readonly icon: ReactNode
  readonly title: MediaListRowTitleText
  readonly titleExtractionStatus?: ExtractionStatusTitleSpec
  readonly meta?: ReactNode
  readonly mobileTrailing?: ReactNode
  readonly trailing?: ReactNode
  readonly overlay?: ReactNode
  readonly onActivate: () => void
  readonly disabled?: boolean
  readonly isOpened?: boolean
  readonly wrapperClassName?: string
  readonly buttonClassName?: string
  readonly contentClassName?: string
  readonly overlayClassName?: string
  readonly buttonDataAttributes?: Readonly<Record<string, string | undefined>>
  readonly shouldStackIconOnMobile?: boolean
}

export const MediaListRow = ({
  label,
  icon,
  title,
  titleExtractionStatus,
  meta,
  mobileTrailing,
  trailing,
  overlay,
  onActivate,
  disabled = false,
  isOpened = false,
  wrapperClassName,
  buttonClassName,
  contentClassName,
  overlayClassName,
  buttonDataAttributes,
  shouldStackIconOnMobile = false,
}: MediaListRowProps) => (
  <div
    className={cn(
      "group relative flex w-full items-stretch border-b last:border-b-0",
      shouldStackIconOnMobile && "flex-col md:flex-row",
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
        "absolute inset-0 z-1 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        !disabled && MEDIA_LIST_ROW_HOVER_TINT_CLASS,
        isOpened && !disabled && MEDIA_LIST_ROW_OPENED_TINT_CLASS,
        disabled && "cursor-not-allowed",
        buttonClassName
      )}
      onClick={onActivate}
    />
    <div
      className={cn(
        "pointer-events-none relative z-2 flex min-h-24 flex-1",
        shouldStackIconOnMobile
          ? "flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-3 md:p-0 md:px-4 md:py-6"
          : "min-w-0 items-center gap-3 px-4 py-6",
        contentClassName,
        disabled && "opacity-60"
      )}
    >
      {icon}
      <span
        className={cn(
          "flex min-w-0 flex-1",
          shouldStackIconOnMobile
            ? "items-start md:items-center"
            : "items-center"
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <ExtractionStatusTitle
            status={titleExtractionStatus?.status ?? "idle"}
            fallbackLabel={titleExtractionStatus?.fallbackLabel}
            error={titleExtractionStatus?.error}
            titleClassName={MEDIA_LIST_ROW_TITLE_CLASS}
          >
            <ExpandableFilename
              value={title.value}
              className={MEDIA_LIST_ROW_TITLE_CLASS}
              textClassName={title.isStruckThrough ? "line-through" : undefined}
              isInsideActivationOverlay
            />
          </ExtractionStatusTitle>
          {meta && <span className={MEDIA_LIST_ROW_META_CLASS}>{meta}</span>}
        </span>
        {shouldStackIconOnMobile && mobileTrailing && (
          <span className="flex shrink-0 items-center justify-center self-center md:hidden">
            {mobileTrailing}
          </span>
        )}
        {shouldStackIconOnMobile && overlay && (
          <span
            className={cn(
              "pointer-events-auto -me-4 flex shrink-0 self-stretch items-center justify-center md:hidden",
              MEDIA_LIST_ROW_MENU_CELL_CLASS
            )}
          >
            {overlay}
          </span>
        )}
      </span>
      {trailing}
    </div>
    {overlay && (
      <div
        className={cn(
          "relative z-2 items-center justify-center",
          shouldStackIconOnMobile ? "hidden md:flex" : "flex",
          MEDIA_LIST_ROW_MENU_CELL_CLASS,
          overlayClassName
        )}
      >
        {overlay}
      </div>
    )}
  </div>
)
