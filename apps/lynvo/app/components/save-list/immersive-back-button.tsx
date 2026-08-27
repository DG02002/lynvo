import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "~/components/ui/button"

interface ImmersiveBackButtonProps {
  readonly onExit: () => void
}

export const ImmersiveBackButton = ({ onExit }: ImmersiveBackButtonProps) => (
  <Button
    type="button"
    variant="ghost"
    aria-label="Back"
    className="h-full w-full justify-center rounded-none px-2 text-lg text-foreground hover:bg-muted/70 hover:text-foreground md:px-4"
    onClick={onExit}
  >
    <HugeiconsIcon
      icon={ArrowLeft01Icon}
      className="size-6 text-foreground"
      data-icon="inline-start"
    />
    <span className="hidden md:inline">Back</span>
  </Button>
)
