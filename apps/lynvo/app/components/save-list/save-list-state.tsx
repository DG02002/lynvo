import { Archive04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { ReactNode } from "react"
import { Spinner } from "~/components/spinner"

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
}

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
      <h2
        id={titleId}
        className="font-heading text-xl font-semibold tracking-tight"
      >
        {title}
      </h2>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground text-pretty">
        {description}
      </p>
    </div>
    {action}
  </section>
)

export const SaveListLoadingState = ({ label }: SaveListLoadingStateProps) => (
  <div
    aria-label={label}
    className="flex min-h-56 items-center justify-center"
    role="status"
  >
    <Spinner aria-hidden="true" />
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
