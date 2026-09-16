"use client"

import * as React from "react"
import { MinusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

export const InputOTPSeparator = ({
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="input-otp-separator"
    className="flex items-center [&_svg:not([class*='size-'])]:size-4 border-none"
    {...props}
  >
    <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} />
  </div>
)
