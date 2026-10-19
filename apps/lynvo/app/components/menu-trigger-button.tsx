import type { ComponentProps } from "react"

import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export type MenuTriggerLook = "media-row" | "gallery-overlay"

// Menu triggers that live inside media rows or on top of gallery artwork
// reshape the Button past its variants: row triggers fill their grid cell as
// a square chromeless hit target (on ghost), gallery triggers float as a
// round overlay dot (on overlay). The shape and resting-foreground classes
// are the whole restyle and are permitted by the Button contract in
// .oxlintrc.json. The `[&_svg]:size-7!` marker is load-bearing: the base
// Button sizes icons through a higher-specificity `:not()` selector.
const mediaRowTriggerClass =
  "size-full rounded-none text-foreground [&_svg]:size-7!"
const galleryOverlayTriggerClass = "rounded-full"

const MENU_TRIGGER_LOOKS = {
  "media-row": {
    variant: "ghost",
    size: "icon",
  },
  "gallery-overlay": {
    variant: "overlay",
    size: "icon-lg",
  },
} satisfies Record<
  MenuTriggerLook,
  Pick<ComponentProps<typeof Button>, "variant" | "size">
>

type MenuTriggerButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size"
> & {
  look: MenuTriggerLook
}

export const MenuTriggerButton = ({
  look,
  className,
  ...props
}: MenuTriggerButtonProps) => {
  const triggerLook = MENU_TRIGGER_LOOKS[look]

  return (
    <Button
      {...props}
      variant={triggerLook.variant}
      size={triggerLook.size}
      className={cn(
        look === "gallery-overlay"
          ? galleryOverlayTriggerClass
          : mediaRowTriggerClass,
        className
      )}
    />
  )
}
