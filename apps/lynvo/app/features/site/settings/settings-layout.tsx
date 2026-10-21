import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"
import { Link, type LinkProps } from "react-router"

import { SelectTrigger as LynvoSelectTrigger } from "~/components/select-trigger"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"
import { SelectContent } from "~/components/ui/select"
import { Skeleton } from "~/components/ui/skeleton"
import { useViewTransition } from "~/lib/client-profile"
import { cn } from "~/lib/utils"

import {
  settingsActionRowClass,
  settingsListClass,
  settingsRowClass,
  settingsRowDescriptionClass,
  settingsRowLabelClass,
  settingsWarningTextClass,
} from "./settings-layout-classes"

export function SettingsPanel({
  children,
  className,
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 px-0 pb-5 pt-1 sm:pb-6 animate-in fade-in fill-mode-both duration-500 motion-reduce:animate-none",
        className
      )}
    >
      {children}
    </section>
  )
}

export function SettingsList({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn(settingsListClass, className)} {...props}>
      {children}
    </div>
  )
}

export function SettingsRow({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn(settingsRowClass, className)} {...props}>
      {children}
    </div>
  )
}

export function SettingsDisclosureContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("ms-15 border-t border-border", className)} {...props}>
      {children}
    </div>
  )
}

export function SettingsDisclosure({
  canExpand = true,
  children,
  contentClassName,
  contentId: providedContentId,
  defaultExpanded = false,
  expanded,
  label,
  onExpandedChange,
  renderHeader,
}: {
  canExpand?: boolean
  children: React.ReactNode
  contentClassName?: string
  contentId?: string
  defaultExpanded?: boolean
  expanded?: boolean
  label: string
  onExpandedChange?: (expanded: boolean) => void
  renderHeader: (disclosureButton: React.ReactNode) => React.ReactNode
}) {
  const generatedContentId = React.useId()
  const contentId = providedContentId ?? generatedContentId
  const [uncontrolledExpanded, setUncontrolledExpanded] =
    React.useState(defaultExpanded)
  const isExpanded = canExpand && (expanded ?? uncontrolledExpanded)

  const toggleExpanded = () => {
    const nextExpanded = !isExpanded
    if (expanded === undefined) {
      setUncontrolledExpanded(nextExpanded)
    }
    onExpandedChange?.(nextExpanded)
  }

  const disclosureButton = canExpand ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10"
      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label}`}
      aria-expanded={isExpanded}
      aria-controls={contentId}
      onClick={toggleExpanded}
    >
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className={cn(
          "transition-transform duration-200",
          isExpanded ? "rotate-180" : "rotate-0"
        )}
      />
    </Button>
  ) : null

  return (
    <div className="flex flex-col">
      {renderHeader(disclosureButton)}
      <SettingsDisclosureContent
        id={contentId}
        className={cn(!isExpanded && "hidden", contentClassName)}
      >
        {isExpanded ? children : null}
      </SettingsDisclosureContent>
    </div>
  )
}

export function SettingsLoadingBars({
  className,
  titleWidth,
}: {
  className?: string
  titleWidth: "sm" | "lg"
}) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      <Skeleton className={titleWidth === "lg" ? "h-4 w-48" : "h-4 w-40"} />
      <Skeleton radius="full" className="h-2 w-full" />
    </div>
  )
}

// Every settings select renders as a quiet inline value control: no chrome,
// no focus ring, muted hover. The restyle classes are the SelectTrigger
// contract in .oxlintrc.json; what the trigger already provides (text-sm,
// h-8 at size sm, transition, outline) is not repeated here.
const settingsSelectTriggerRestyleClass =
  "bg-transparent border-transparent px-2.5 py-1 gap-1 rounded-xl text-foreground hover:bg-muted focus-visible:ring-0 select-none w-auto justify-end"

export function SettingsSelectTrigger({
  className,
  ...props
}: React.ComponentProps<typeof LynvoSelectTrigger>) {
  return (
    <LynvoSelectTrigger
      {...props}
      className={cn(settingsSelectTriggerRestyleClass, className)}
    />
  )
}

export function SettingsSelectContent({
  className,
  ...props
}: React.ComponentProps<typeof SelectContent>) {
  return (
    <SelectContent {...props} className={cn("w-max min-w-max", className)} />
  )
}

type SettingsActionRowProps =
  | ({ as?: "button" } & React.ComponentProps<"button">)
  | ({ as: "link" } & LinkProps)
  | ({ as: "div" } & React.ComponentProps<"div">)

export function SettingsActionRow(props: SettingsActionRowProps) {
  const clientViewTransition = useViewTransition()

  if (props.as === "link") {
    const {
      as: _as,
      className,
      viewTransition = true,
      prefetch = "intent",
      ...linkProps
    } = props
    return (
      <Link
        {...linkProps}
        prefetch={prefetch}
        viewTransition={clientViewTransition && viewTransition}
        className={cn(
          settingsActionRowClass,
          "cursor-pointer select-none",
          className
        )}
      />
    )
  }
  if (props.as === "div") {
    const { as: _as, className, ...divProps } = props
    return (
      <div
        className={cn(
          settingsActionRowClass,
          "cursor-pointer select-none",
          className
        )}
        {...divProps}
      />
    )
  }
  const { as: _as, className, ...buttonProps } = props
  return (
    <button
      type="button"
      className={cn(
        settingsActionRowClass,
        "cursor-pointer select-none",
        className
      )}
      {...buttonProps}
    />
  )
}

export function SettingsRowInfo({
  label,
  labelId,
  description,
  note,
  destructive = false,
  className,
}: {
  label: string
  labelId?: string
  description?: string
  note?: string
  destructive?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 pr-4 min-w-0 text-left flex-1",
        className
      )}
    >
      <span
        id={labelId}
        className={cn(settingsRowLabelClass, destructive && "text-destructive")}
      >
        {label}
      </span>
      {description && (
        <span
          className={cn(
            settingsRowDescriptionClass,
            destructive && "text-destructive/80"
          )}
        >
          {description}
        </span>
      )}
      {note && (
        <span
          className={cn("text-xs leading-normal", settingsWarningTextClass)}
        >
          {note}
        </span>
      )}
    </div>
  )
}

export function SectionHeading({
  title,
  description,
  destructive = false,
  size = "default",
  descriptionSize = "sm",
}: {
  title: string
  description?: string
  destructive?: boolean
  size?: "default" | "base"
  descriptionSize?: "sm" | "base"
}) {
  const descriptionSizeClass =
    descriptionSize === "base" ? "text-base" : "text-sm"

  return (
    <div className="flex flex-col gap-1">
      <SettingsHeadingText
        as="h2"
        size={size === "base" ? "base" : "large"}
        className={destructive ? "text-destructive" : undefined}
      >
        {title}
      </SettingsHeadingText>
      {description && (
        <p
          className={cn(
            "max-w-2xl text-muted-foreground",
            descriptionSizeClass
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}

export function SettingsHeadingText({
  as: Heading = "h2",
  children,
  className,
  size = "base",
}: {
  as?: "h2" | "h3" | "h4"
  children: React.ReactNode
  className?: string
  size?: "base" | "large"
}) {
  return (
    <Heading
      className={cn(
        size === "large" ? "text-lg" : "text-base",
        "font-normal tracking-tight text-foreground",
        className
      )}
    >
      {children}
    </Heading>
  )
}

export function SettingsUsageMeter({
  footer,
  progress,
  title,
  trailing,
}: {
  footer?: React.ReactNode
  progress?: { value: number; label: string }
  title: React.ReactNode
  trailing: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex items-center justify-between gap-4">
        {title}
        <div className="flex shrink-0 items-center gap-2 text-base font-normal tabular-nums text-foreground">
          {trailing}
        </div>
      </div>
      {progress && (
        <Progress value={progress.value} aria-label={progress.label} />
      )}
      {footer}
    </div>
  )
}
