import { Archive04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { ReactNode } from "react"

import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"

import { SaveListBackButton } from "./save-list-header-controls"
import {
  FINDER_FOLDER_CONTENT_GRID_CLASS,
  GALLERY_GROUP_CONTENT_CLASS,
  GALLERY_GRID_CLASS,
  SAVE_LIST_BROWSER_LAYOUT_CLASS,
  SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS,
} from "./save-list-layout-constants"

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

export const SaveListCardSkeleton = ({ label }: { readonly label: string }) => (
  <Skeleton
    aria-label={label}
    className="loading-skeleton-pulse size-full rounded-none bg-gradient-to-br from-muted to-muted-foreground/15"
    role="status"
  />
)

interface SaveListImmersiveLoadingStateProps {
  readonly onNavigateBack: () => void
  readonly kind: "folder" | "gallery-group"
}

const FolderAside = () => (
  <aside className="min-w-0 overflow-hidden border-b px-4 py-3 md:border-r md:border-b-0 md:p-3">
    <Skeleton
      aria-hidden="true"
      className="loading-skeleton-pulse h-9 w-full md:hidden"
    />
    <div className="hidden flex-col gap-2 md:flex" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex h-9 items-center gap-2 px-2">
          <Skeleton className="loading-skeleton-pulse size-4 rounded-md" />
          <Skeleton className="loading-skeleton-pulse h-4 flex-1" />
        </div>
      ))}
    </div>
  </aside>
)

const GalleryGroupAside = () => (
  <aside className="border-b bg-muted/50 p-4 md:border-b-0 md:border-r md:p-6 dark:bg-transparent">
    <div className="mx-auto w-full max-w-72 md:mx-0 md:w-full md:max-w-none">
      <div className="save-list-group-artwork-frame relative aspect-2/3 overflow-hidden rounded-2xl border border-foreground/15 bg-muted shadow-depth-m">
        <SaveListCardSkeleton label="Loading artwork…" />
      </div>
    </div>
  </aside>
)

interface ImmersiveLoadingPreset {
  readonly contentGridClass: string
  readonly contentScrollClass: string
  readonly loadingLabel: string
  readonly loadingVariant: "list" | "gallery"
  readonly Aside: () => ReactNode
}

const immersiveLoadingPresets = {
  folder: {
    contentGridClass: FINDER_FOLDER_CONTENT_GRID_CLASS,
    contentScrollClass:
      "overflow-x-hidden overflow-y-auto overscroll-y-contain",
    loadingLabel: "Loading folder…",
    loadingVariant: "gallery",
    Aside: FolderAside,
  },
  "gallery-group": {
    contentGridClass: GALLERY_GROUP_CONTENT_CLASS,
    contentScrollClass:
      "md:overflow-x-hidden md:overflow-y-auto md:overscroll-y-contain",
    loadingLabel: "Loading gallery group…",
    loadingVariant: "list",
    Aside: GalleryGroupAside,
  },
} satisfies Record<"folder" | "gallery-group", ImmersiveLoadingPreset>

export const SaveListImmersiveLoadingState = ({
  onNavigateBack,
  kind,
}: SaveListImmersiveLoadingStateProps) => {
  const preset = immersiveLoadingPresets[kind]
  return (
    <section
      className={cn(
        SAVE_LIST_BROWSER_LAYOUT_CLASS,
        "flex h-svh flex-col overflow-hidden bg-background"
      )}
    >
      <header className={SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS}>
        <SaveListBackButton onNavigateBack={onNavigateBack} />
        <div className="min-w-0 md:flex md:w-full md:items-center md:px-4 md:py-3">
          <Skeleton
            aria-hidden="true"
            className="loading-skeleton-pulse hidden h-5 w-48 md:block"
          />
        </div>
        <div className="flex items-center justify-center">
          <Skeleton
            aria-hidden="true"
            className="loading-skeleton-pulse size-5 rounded-sm"
          />
        </div>
        <div className="flex items-center justify-center border-l">
          <Skeleton
            aria-hidden="true"
            className="loading-skeleton-pulse size-9 rounded-lg"
          />
        </div>
      </header>
      <div className={preset.contentGridClass}>
        <preset.Aside />
        <div
          className={cn(
            "min-h-0 px-4 py-3 md:px-6 md:py-5",
            preset.contentScrollClass
          )}
        >
          <SaveListLoadingState
            label={preset.loadingLabel}
            variant={preset.loadingVariant}
          />
        </div>
      </div>
    </section>
  )
}

export const SaveListEmptyState = () => (
  <SaveListState
    title="No saved links yet"
    titleId="save-list-empty-title"
    description="Save a movie, show, or folder to see it here."
    icon={Archive04Icon}
  />
)
