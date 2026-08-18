import { HugeiconsIcon } from "@hugeicons/react"
import { Route01Icon } from "@hugeicons/core-free-icons"
import { PluginIcon } from "~/components/plugin-icon"
import type { MetaData } from "~/features/links/types"

export const ExtractionSourceFlow = ({
  meta,
  statusLabel,
}: {
  meta: MetaData
  statusLabel?: string
}) => {
  const sourceName = meta.sourceName || meta.pluginName || "Direct Media"

  if (!meta.sourceName || !meta.pluginName) {
    return (
      <div
        data-slot="extraction-source-flow"
        className="mx-auto flex w-full max-w-lg min-w-0 items-center gap-2 px-1"
        role="status"
      >
        <PluginIcon
          iconUrl={meta.sourceIconUrl || meta.pluginIcon}
          fallback={meta.sourceName ? "source" : "plugin-server"}
          className="size-4 shrink-0"
        />
        <span className="shimmer min-w-0 text-pretty font-medium text-foreground">
          {sourceName}
        </span>
        {statusLabel && (
          <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wide">
            {statusLabel}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      data-slot="extraction-source-flow"
      className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-1.5 px-1"
      role="status"
      aria-label={`${meta.sourceName} from ${meta.pluginName}`}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <PluginIcon fallback="plugin-server" className="size-4 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="shimmer text-[10px] leading-none text-muted-foreground">
              Plugin Server
            </span>
            <span className="shimmer mt-1 min-w-0 text-pretty font-medium leading-tight text-foreground">
              {meta.pluginName}
            </span>
          </span>
        </div>

        <span
          className="shimmer overflow-hidden whitespace-nowrap text-center text-[10px] tracking-widest text-muted-foreground"
          aria-hidden="true"
        >
          •••••
        </span>

        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="flex min-w-0 flex-col items-end">
            <span className="shimmer text-[10px] leading-none text-muted-foreground">
              Source
            </span>
            <span className="shimmer mt-1 min-w-0 text-pretty font-medium leading-tight text-foreground">
              {meta.sourceName}
            </span>
          </span>
          <PluginIcon
            iconUrl={meta.sourceIconUrl || meta.pluginIcon}
            fallback="source"
            className="size-4 shrink-0"
          />
        </div>
      </div>

      {(statusLabel || meta.routeSourceName) && (
        <div
          className="flex min-w-0 items-center gap-2 pl-6"
          aria-label={
            meta.routeSourceName
              ? `Routes to ${meta.routeSourceName}`
              : undefined
          }
        >
          {meta.routeSourceName && (
            <>
              <HugeiconsIcon icon={Route01Icon} className="size-4 shrink-0" />
              <PluginIcon
                iconUrl={meta.routeSourceIconUrl}
                fallback="source"
                className="size-4 shrink-0"
              />
              <span className="shimmer min-w-0 font-medium text-foreground">
                {meta.routeSourceName}
              </span>
            </>
          )}
          {statusLabel && (
            <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wide">
              {statusLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
