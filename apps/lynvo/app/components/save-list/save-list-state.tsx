import { Archive04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { ReactNode } from "react"

import { GALLERY_GRID_CLASS } from "./save-list-layout-constants"

interface SaveListStateProps {
  readonly title: string
  readonly titleId: string
  readonly description: string
  readonly icon: IconSvgElement
  readonly role?: "alert"
  readonly action?: ReactNode
}

interface SaveListLoadingStateProps {
  readonly label: string
  readonly variant?: "list" | "gallery"
}

const SKELETON_BLOCK_CLASS = "loading-skeleton-pulse rounded-xl bg-muted"

const SaveListSkeletonRow = () => (
  <div className="flex items-center gap-4 py-4">
    <div className={`size-10 shrink-0 rounded-full ${SKELETON_BLOCK_CLASS}`} />
    <div className="flex w-full max-w-md flex-col gap-2">
      <div className={`h-4 w-3/5 ${SKELETON_BLOCK_CLASS}`} />
      <div className={`h-3 w-2/5 ${SKELETON_BLOCK_CLASS}`} />
    </div>
  </div>
)

const SaveListSkeletonTile = () => (
  <div className="w-full">
    <div
      className={`aspect-2/3 w-full rounded-2xl sm:rounded-3xl ${SKELETON_BLOCK_CLASS}`}
    />
    <div className={`mx-auto mt-3 h-4 w-2/3 ${SKELETON_BLOCK_CLASS}`} />
  </div>
)

const SaveListState = ({
  title,
  titleId,
  description,
  icon,
  role,
  action,
}: SaveListStateProps) => (
  <section
    aria-labelledby={titleId}
    className="flex min-h-72 w-full flex-col items-center justify-center px-6 py-16 text-center"
    role={role}
  >
    <div
      aria-hidden="true"
      className="mb-5 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
    >
      <HugeiconsIcon icon={icon} strokeWidth={1.8} className="size-7" />
    </div>
    <div className="flex max-w-md flex-col items-center gap-2">
      <h2 id={titleId} className="font-heading text-xl font-semibold">
        {title}
      </h2>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground text-pretty">
        {description}
      </p>
    </div>
    {action}
  </section>
)

export const SaveListLoadingState = ({
  label,
  variant = "list",
}: SaveListLoadingStateProps) => (
  <div
    aria-label={label}
    className="flex min-h-56 w-full flex-col justify-center"
    role="status"
  >
    <span className="sr-only">{label}</span>
    {variant === "gallery" ? (
      <div className={GALLERY_GRID_CLASS} aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <SaveListSkeletonTile key={index} />
        ))}
      </div>
    ) : (
      <div
        className="flex flex-col divide-y divide-border/70"
        aria-hidden="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <SaveListSkeletonRow key={index} />
        ))}
      </div>
    )}
  </div>
)

export const SaveListEmptyState = () => (
  <SaveListState
    title="No saved links yet"
    titleId="save-list-empty-title"
    description="Save a movie, show, or folder to see it here."
    icon={Archive04Icon}
  />
)
