import type { ComponentProps } from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { SelectTrigger as UiSelectTrigger } from "~/components/ui/select"
import { cn } from "~/lib/utils"

export const SelectTrigger = ({
  children,
  className,
  ...props
}: ComponentProps<typeof UiSelectTrigger>) => (
  <UiSelectTrigger
    className={cn("[&>svg:last-child]:hidden", className)}
    {...props}
  >
    {children}
    <HugeiconsIcon
      icon={ArrowDown01Icon}
      strokeWidth={2}
      className="pointer-events-none size-4 text-muted-foreground"
    />
  </UiSelectTrigger>
)
