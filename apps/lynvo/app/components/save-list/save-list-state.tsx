import {
  Archive04Icon,
  CloudOffIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { ReactNode } from "react"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"

interface SaveListStateProps {
  readonly title: string
  readonly titleId: string
  readonly description: string
  readonly icon: IconSvgElement
  readonly role?: "alert"
  readonly action?: ReactNode
}

interface SaveListErrorStateProps {
  readonly onRetry?: () => void
}

interface SaveListLoadingStateProps {
  readonly label: string
}

interface SaveListStaleStateProps {
  readonly onRetry?: () => void
}

interface SaveListRetryButtonProps {
  readonly onRetry: () => void
  readonly variant?: "ghost" | "outline"
  readonly size?: "lg" | "sm"
  readonly className?: string
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

const SaveListRetryButton = ({
  onRetry,
  variant = "outline",
  size = "lg",
  className,
}: SaveListRetryButtonProps) => (
  <Button
    type="button"
    variant={variant}
    size={size}
    className={className}
    onClick={onRetry}
  >
    <HugeiconsIcon
      icon={Refresh01Icon}
      data-icon="inline-start"
      aria-hidden="true"
    />
    Try again
  </Button>
)

export const SaveListEmptyState = () => (
  <SaveListState
    title="No saved links yet"
    titleId="save-list-empty-title"
    description="Save a movie, show, or folder to start building your library."
    icon={Archive04Icon}
  />
)

export const SaveListErrorState = ({ onRetry }: SaveListErrorStateProps) => (
  <SaveListState
    title="Library temporarily unavailable"
    titleId="save-list-error-title"
    description="Your saved links are safe. Check your connection or try again in a moment."
    icon={CloudOffIcon}
    role="alert"
    action={
      onRetry && <SaveListRetryButton onRetry={onRetry} className="mt-6" />
    }
  />
)

export const SaveListStaleState = ({ onRetry }: SaveListStaleStateProps) => (
  <div className="flex w-full flex-wrap items-center justify-between gap-3 px-1 text-sm">
    <p
      className="flex min-w-0 items-center gap-2 text-muted-foreground"
      role="status"
    >
      <HugeiconsIcon
        icon={CloudOffIcon}
        strokeWidth={1.8}
        className="size-4 shrink-0"
        aria-hidden="true"
      />
      <span>
        Showing your last saved library. We’ll refresh when the connection is
        restored.
      </span>
    </p>
    {onRetry && (
      <SaveListRetryButton
        onRetry={onRetry}
        variant="ghost"
        size="sm"
        className="shrink-0"
      />
    )}
  </div>
)
