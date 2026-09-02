import type { ComponentProps } from "react"
import { cn } from "~/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { LoaderCircle as LoaderCircleIcon } from "@hugeicons/core-free-icons"

type SpinnerProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon">

const Spinner = ({ className, ...props }: SpinnerProps) => (
  <HugeiconsIcon
    icon={LoaderCircleIcon}
    data-slot="spinner"
    role="status"
    aria-label="Loading"
    className={cn("size-4 animate-spin", className)}
    {...props}
  />
)

export { Spinner }
