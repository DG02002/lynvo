import type { ReactNode } from "react"
import { cn } from "~/lib/utils"

interface AnimatedStateIconProps {
  readonly stateKey: string
  readonly children: ReactNode
  readonly className?: string
}

export const AnimatedStateIcon = ({
  stateKey,
  children,
  className,
}: AnimatedStateIconProps) => (
  <span key={stateKey} className={cn("icon-swap-enter inline-flex", className)}>
    {children}
  </span>
)
