import type { ComponentProps } from "react"
import { FloatingLabel } from "~/components/FloatingLabel"
import { cn } from "~/lib/utils"

export interface FormDialogInputProps extends ComponentProps<
  typeof FloatingLabel
> {
  tone?: "default" | "destructive"
}

export const FormDialogInput = ({
  tone = "default",
  className,
  labelClassName,
  ...props
}: FormDialogInputProps) => (
  <FloatingLabel
    className={cn(
      tone === "destructive" &&
        "border-destructive/50 focus:border-destructive focus:ring-2 focus:ring-destructive/20",
      className
    )}
    labelClassName={cn(
      "bg-popover",
      tone === "destructive" && "peer-focus:text-destructive",
      labelClassName
    )}
    {...props}
  />
)
