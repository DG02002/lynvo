import * as React from "react"
import { Link, type LinkProps } from "react-router"
import { cn } from "~/lib/utils"
import {
  settingsActionRowClass,
  settingsListClass,
  settingsRowClass,
  settingsRowDescriptionClass,
  settingsRowLabelClass,
} from "./settings-layout-classes"

export function SettingsPanel({
  children,
  className,
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex flex-col gap-4 px-0 pb-5 pt-1 sm:pb-6", className)}
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

type SettingsActionRowProps =
  | ({ as?: "button" } & React.ComponentProps<"button">)
  | ({ as: "link" } & LinkProps)
  | ({ as: "div" } & React.ComponentProps<"div">)

export function SettingsActionRow(props: SettingsActionRowProps) {
  const { as, className: customClassName, ...rest } = props as any
  const className = cn(
    settingsActionRowClass,
    "cursor-pointer select-none",
    customClassName
  )
  if (as === "link") {
    return <Link viewTransition className={className} {...rest} />
  } else if (as === "div") {
    return <div className={className} {...rest} />
  } else {
    return <button type="button" className={className} {...rest} />
  }
}

export function SettingsRowInfo({
  label,
  description,
  destructive = false,
  className,
}: {
  label: string
  description?: string
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
        className={cn(
          "text-lg font-normal tracking-tight",
          destructive && "text-destructive"
        )}
      >
        {title}
      </h2>
      {description && (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
