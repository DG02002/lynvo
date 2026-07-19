"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-2 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 **:data-[slot=kbd]:rounded-4xl **:data-[slot=kbd]:bg-muted-foreground/10 **:data-[slot=kbd]:px-1.5 [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3 has-[>button]:-ml-1 has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "order-last pr-3 has-[>button]:-mr-1 has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-3 [.border-b]:pb-3",
        "block-end":
          "order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-3 [.border-t]:pt-3",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

export const InputGroupAddon = ({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof inputGroupAddonVariants>) => (
  <div
    role="group"
    data-slot="input-group-addon"
    data-align={align}
    className={cn(inputGroupAddonVariants({ align }), className)}
    onClick={(event) => {
      if ((event.target as HTMLElement).closest("button")) {
        return
      }
      event.currentTarget.parentElement?.querySelector("input")?.focus()
    }}
    onKeyDown={(event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }
      event.preventDefault()
      event.currentTarget.parentElement?.querySelector("input")?.focus()
    }}
    {...props}
  />
)
