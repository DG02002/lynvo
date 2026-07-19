import * as React from "react"
import { cn } from "~/lib/utils"

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string
  fallback?: React.ReactNode
}

/**
 * A wrapper around the native <img> tag that enforces best practices for performance:
 * - lazy loading
 * - async decoding
 *
 * Compatible with Chrome 81+ (Android TV).
 */
export function OptimizedImage({
  className,
  fallback,
  alt,
  ...props
}: OptimizedImageProps) {
  const [hasError, setHasError] = React.useState(false)

  if (hasError && fallback) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        {fallback}
      </div>
    )
  }

  return (
    <img
      loading="lazy"
      decoding="async"
      alt={alt}
      {...props}
      onError={() => setHasError(true)}
      className={cn(
        "object-contain",
        hasError && !fallback && "opacity-0",
        className
      )}
    />
  )
}
