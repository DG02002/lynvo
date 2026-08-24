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
export const settingsSelectTriggerClass =
  "bg-transparent border border-transparent shadow-none px-2.5 py-1 h-8 gap-1 rounded-xl text-sm font-normal text-foreground hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none transition-colors cursor-pointer select-none w-auto justify-end"
export const settingsSelectContentClass = "w-max min-w-max"
