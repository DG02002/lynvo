import * as React from "react"
import { cn } from "~/lib/utils"
import { FilenameText } from "~/components/filename-text"

interface ExpandableFilenameProps {
  value: string
  className?: string
  textClassName?: string
  clampClassName?: string
  toggleClassName?: string
  isInsideActivationOverlay?: boolean
}

const ACTIVATION_OVERLAY_TOGGLE_CLASS = "pointer-events-auto relative z-10"

export const ExpandableFilename = ({
  value,
  className,
  textClassName,
  clampClassName,
  toggleClassName,
  isInsideActivationOverlay = false,
}: ExpandableFilenameProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <FilenameText
      value={value}
      className={className}
      textClassName={textClassName}
      clampClassName={clampClassName}
      isExpanded={isExpanded}
      toggle={
        <button
          type="button"
          aria-expanded={isExpanded}
          className={cn(
            "ml-1 inline cursor-pointer border-0 bg-transparent p-0 font-medium text-muted-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isInsideActivationOverlay && ACTIVATION_OVERLAY_TOGGLE_CLASS,
            toggleClassName
          )}
          onClick={(event) => {
            event.stopPropagation()
            setIsExpanded((currentIsExpanded) => !currentIsExpanded)
          }}
        >
          {isExpanded ? "See less" : "See more"}
        </button>
      }
    />
  )
}
