import * as React from "react"
import { Link, type LinkProps } from "react-router"

import { SelectTrigger as LynvoSelectTrigger } from "~/components/select-trigger"
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
      size="sm"
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
}: {
  title: string
  description?: string
  destructive?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2
        className={cn("text-lg font-normal", destructive && "text-destructive")}
      >
        {title}
      </h2>
      {description && (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
