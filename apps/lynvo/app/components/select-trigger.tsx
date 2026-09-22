import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps } from "react"

import { SelectTrigger as UiSelectTrigger } from "~/components/ui/select"
import { cn } from "~/lib/utils"

type AccessibleNameProps =
  | {
      "aria-label": string
      "aria-labelledby"?: never
    }
  | {
      "aria-label"?: never
      "aria-labelledby": string
    }

type SelectTriggerProps = Omit<
  ComponentProps<typeof UiSelectTrigger>,
  "aria-label" | "aria-labelledby"
> &
  AccessibleNameProps

export const SelectTrigger = ({
  children,
  className,
  ...props
}: SelectTriggerProps) => (
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
