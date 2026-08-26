import { GridViewIcon, ListViewIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"

interface MediaViewOption {
  value: MediaView
  label: string
  description: string
  icon: IconSvgElement
  isBeta: boolean
}

interface MediaViewSelectorProps {
  value: MediaView
  onValueChange: (value: MediaView) => void
}

interface MediaViewPreviewProps {
  view: MediaView
}

const mediaViewOptions: readonly MediaViewOption[] = [
  {
    value: "list",
    label: "List view",
    description: "Browse every saved link in rows.",
    icon: ListViewIcon,
    isBeta: false,
  },
  {
    value: "hybrid",
    label: "Hybrid view",
    description: "Group movies and shows with artwork.",
    icon: GridViewIcon,
    isBeta: true,
  },
]

const ListViewPreview = () => (
  <div aria-hidden="true" className="flex h-full min-h-0 flex-col gap-2 p-2">
    <span className="h-2 w-16 rounded-full bg-foreground/20" />
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center gap-2 border-b border-border/70">
        <span className="size-5 shrink-0 rounded bg-foreground/10" />
        <span className="h-1.5 w-2/3 rounded-full bg-foreground/15" />
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-2 border-b border-border/70">
        <span className="size-5 shrink-0 rounded bg-foreground/10" />
        <span className="h-1.5 w-1/2 rounded-full bg-foreground/15" />
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-2">
        <span className="size-5 shrink-0 rounded bg-foreground/10" />
        <span className="h-1.5 w-3/5 rounded-full bg-foreground/15" />
      </div>
    </div>
  </div>
)

const HybridViewPreview = () => (
  <div aria-hidden="true" className="flex h-full min-h-0 flex-col gap-2 p-2">
    <span className="h-2 w-16 rounded-full bg-foreground/20" />
    <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
      <span className="min-w-0 rounded-lg border border-foreground/15 bg-foreground/10" />
      <span className="min-w-0 rounded-lg border border-foreground/15 bg-foreground/10" />
      <span className="min-w-0 rounded-lg border border-foreground/15 bg-foreground/10" />
    </div>
  </div>
)

const MediaViewPreview = ({ view }: MediaViewPreviewProps) =>
  view === "list" ? <ListViewPreview /> : <HybridViewPreview />

export const MediaViewSelector = ({
  value,
  onValueChange,
}: MediaViewSelectorProps) => (
  <fieldset className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
    <legend className="sr-only">Saved links view</legend>
    {mediaViewOptions.map((option) => {
      const isSelected = value === option.value

      return (
        <label
          key={option.value}
          className={cn(
            "group flex min-w-0 cursor-pointer flex-col gap-2 rounded-2xl border p-2 text-left transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none",
            isSelected
              ? "border-sky-500 bg-sky-500/15 shadow-sm"
              : "border-border bg-background"
          )}
        >
          <input
            className="peer sr-only"
            type="radio"
            name="media-view"
            value={option.value}
            aria-label={option.label}
            checked={isSelected}
            onChange={() => onValueChange(option.value)}
          />
          <span className="block aspect-video min-h-0 overflow-hidden rounded-xl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
            <MediaViewPreview view={option.value} />
          </span>
          <span className="flex min-w-0 flex-col gap-1 px-1 pb-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <HugeiconsIcon
                icon={option.icon}
                className="size-4 shrink-0"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">{option.label}</span>
              {option.isBeta && (
                <Badge
                  variant="outline"
                  className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-400"
                >
                  Beta
                </Badge>
              )}
            </span>
            <span className="text-xs leading-normal text-muted-foreground">
              {option.description}
            </span>
          </span>
        </label>
      )
    })}
  </fieldset>
)
