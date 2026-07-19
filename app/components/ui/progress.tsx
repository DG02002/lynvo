"use client"

import * as React from "react"

import { cn } from "~/lib/utils"

function Progress({
  className,
  value,
  max = 100,
  ...props
}: React.ComponentProps<"progress"> & {
  value?: number | null
  max?: number
}) {
  const normalizedValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(Math.max(value, 0), max)
      : 0

  return (
    <progress
      data-slot="progress"
      value={normalizedValue}
      max={max}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full appearance-none border-none bg-primary/20",
        "[&::-webkit-progress-bar]:bg-transparent",
        "[&::-webkit-progress-value]:bg-primary",
        "[&::-webkit-progress-value]:transition-all",
        "[&::-moz-progress-bar]:bg-primary",
        className
      )}
      {...props}
    />
  )
}

export { Progress }
