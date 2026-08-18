import { Link } from "react-router"
import { PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "~/lib/utils"

interface LogoProps {
  variant?: "text-only" | "icon-text" | "icon-only"
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "size-6",
  md: "size-8",
  lg: "size-12",
}

const textSizeClasses = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
}

const Logo = ({ variant = "icon-text", size = "md", className }: LogoProps) => {
  const iconSize = sizeClasses[size]
  const textSize = textSizeClasses[size]

  if (variant === "icon-only") {
    return (
      <span
        className={cn("flex items-center justify-center", iconSize, className)}
      >
        <HugeiconsIcon
          icon={PlayIcon}
          className="size-full"
          aria-label="Lynvo"
        />
      </span>
    )
  }

  if (variant === "text-only") {
    return <span className={cn("font-bold", textSize)}>Lynvo</span>
  }

  // icon-text variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("flex items-center justify-center", iconSize)}>
        <HugeiconsIcon
          icon={PlayIcon}
          className="size-full"
          aria-hidden="true"
        />
      </span>
      <span className={cn("font-bold", textSize)}>Lynvo</span>
    </div>
  )
}

export const LogoLink = ({
  variant = "icon-text",
  size = "md",
  className,
}: LogoProps) => {
  return (
    <Link
      to="/"
      prefetch="intent"
      viewTransition
      className={cn(
        "flex items-center gap-2 hover:opacity-80 transition-opacity",
        className
      )}
    >
      <Logo variant={variant} size={size} />
    </Link>
  )
}
