import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface ImmersiveBackButtonProps {
  readonly onNavigateBack: () => void
}

// The immersive header's back region is app chrome rather than a design-system
// button, so it renders as a plain button with its edge-to-edge treatment.
export const ImmersiveBackButton = ({
  onNavigateBack,
}: ImmersiveBackButtonProps) => (
  <button
    type="button"
    aria-label="Back"
    className="inline-flex h-full w-full items-center justify-center gap-1.5 rounded-none px-2 text-lg font-medium whitespace-nowrap text-foreground transition-all outline-none select-none hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:px-4"
    onClick={onNavigateBack}
  >
    <HugeiconsIcon
      icon={ArrowLeft01Icon}
      className="size-6 text-foreground"
      data-icon="inline-start"
    />
    <span className="hidden md:inline">Back</span>
  </button>
)
