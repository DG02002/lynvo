import { cn } from "cn"
import type { ReactNode } from "react"

import {
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"

interface DialogHeroHeaderProps {
  readonly title: ReactNode
  readonly description: ReactNode
  readonly icon?: ReactNode
  readonly className?: string
  readonly descriptionClassName?: string
}

export const DialogHeroHeader = ({
  title,
  description,
  icon,
  className,
  descriptionClassName,
}: DialogHeroHeaderProps) => (
  <DialogHeader variant="hero" className={cn("w-full", className)}>
    {icon}
    <DialogTitle size="hero" className="w-full text-center">
      {title}
    </DialogTitle>
    <DialogDescription
      size="hero"
      className={cn("w-full text-center", descriptionClassName)}
    >
      {description}
    </DialogDescription>
  </DialogHeader>
)

export const AlertDialogHeroHeader = ({
  title,
  description,
  icon,
  className,
  descriptionClassName,
}: DialogHeroHeaderProps) => (
  <AlertDialogHeader variant="hero" className={cn("w-full min-w-0", className)}>
    {icon}
    <AlertDialogTitle size="hero" className="w-full text-center">
      {title}
    </AlertDialogTitle>
    <AlertDialogDescription
      size="hero"
      className={cn("w-full min-w-0 text-center", descriptionClassName)}
    >
      {description}
    </AlertDialogDescription>
  </AlertDialogHeader>
)
