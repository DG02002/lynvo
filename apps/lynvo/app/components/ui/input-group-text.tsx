"use client"

import * as React from "react"

import { cn } from "~/lib/utils"

export const InputGroupText = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    className={cn(
      "flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
)
