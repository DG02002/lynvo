"use client"

import * as React from "react"

import { cn } from "~/lib/utils"

export const InputOTPGroup = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="input-otp-group"
    className={cn(
      "flex items-center rounded-4xl has-aria-invalid:border-destructive has-aria-invalid:ring-[3px] has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
      className
    )}
    {...props}
  />
)
