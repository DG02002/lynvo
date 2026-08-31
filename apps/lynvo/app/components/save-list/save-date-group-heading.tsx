import type { ReactNode } from "react"
import { cn } from "~/lib/utils"

export const SAVE_LIST_SECTION_STACK_CLASS = "flex flex-col gap-12"

const SAVE_LIST_SECTION_ENTER_ANIMATION_CLASS =
  "animate-in fade-in fill-mode-both duration-500 motion-reduce:animate-none"

interface SaveDateGroupHeadingProps {
  readonly label: string
  readonly id?: string
  readonly className?: string
}

export const SaveDateGroupHeading = ({
  label,
  id,
  className,
}: SaveDateGroupHeadingProps) => (
  <h2
    id={id}
    className={cn("font-heading text-2xl font-bold tracking-tight", className)}
  >
    {label}
  </h2>
)

interface SaveDateGroupSectionProps {
  readonly label: string
  readonly children: ReactNode
}

export const SaveDateGroupSection = ({
  label,
  children,
}: SaveDateGroupSectionProps) => {
  const headingId = `save-section-${label.toLowerCase().replaceAll(" ", "-")}`

  return (
    <section
      aria-labelledby={headingId}
      aria-label={label}
      className={cn(
        "flex flex-col gap-4",
        SAVE_LIST_SECTION_ENTER_ANIMATION_CLASS
      )}
    >
      <SaveDateGroupHeading label={label} id={headingId} />
      {children}
    </section>
  )
}
