import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "~/components/ui/button"

interface ImmersiveBackButtonProps {
  readonly onNavigateBack: () => void
}

export const ImmersiveBackButton = ({
  onNavigateBack,
}: ImmersiveBackButtonProps) => (
  <Button
    type="button"
    variant="immersive-back"
    size="immersive-back"
    aria-label="Back"
    onClick={onNavigateBack}
  >
    <HugeiconsIcon
      icon={ArrowLeft01Icon}
      className="size-6 text-foreground"
      data-icon="inline-start"
    />
    <span className="hidden tracking-tight md:inline">Back</span>
  </Button>
)
