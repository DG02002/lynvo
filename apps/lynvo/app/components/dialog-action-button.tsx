import type { ComponentProps } from "react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export const DialogActionButton = ({
  className,
  ...props
}: ComponentProps<typeof Button>) => (
  <Button size="lg" className={cn("h-13.5 w-full", className)} {...props} />
)
