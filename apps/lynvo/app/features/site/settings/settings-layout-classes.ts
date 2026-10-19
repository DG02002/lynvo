import { cn } from "~/lib/utils"

export const settingsListClass =
  "stagger-children flex flex-col divide-y divide-border border-y border-border"
export const settingsRowClass =
  "animate-in fade-in fill-mode-both slide-in-from-bottom-1 duration-300 motion-reduce:animate-none flex w-full items-center justify-between py-4 px-0 text-left"
export const settingsActionRowClass = cn(
  settingsRowClass,
  "hover:bg-muted/40 transition-colors"
)
export const settingsRowLabelClass = "text-sm font-normal text-foreground"
export const settingsRowDescriptionClass =
  "text-xs text-muted-foreground leading-normal"
export const settingsWarningTextClass = "text-warning-foreground"
