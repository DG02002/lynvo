import * as React from "react"
import {
  ArrowDown01Icon,
  Delete02Icon,
  LinkSquare02Icon,
  MoreHorizontalIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "~/components/ui/badge"
import { PluginIcon } from "~/components/plugin-icon"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Switch } from "~/components/ui/switch"
import { cn } from "~/lib/utils"
import { sourceStatusVariant } from "~/lib/source-status-variant"
import {
  isWorkerUsable,
  WORKER_VERIFICATION_STATUS,
} from "~/lib/effect/services/worker-verification-status"
import { getWorkerManifestView } from "./plugin-worker-manifest"
import type { ExtractorWorker } from "./plugins-settings"
import { SettingsList, SettingsRow } from "./settings-layout"

interface ExternalWorkerRowProps {
  worker: ExtractorWorker
  requestOrigin: string
  onDeleteWorker: (workerId: string) => void
  onRefreshWorker: (workerId: string) => void
  onToggleWorker: (workerId: string, currentEnabled: boolean) => void
}

const ExternalWorkerRow = ({
  worker,
  requestOrigin,
  onDeleteWorker,
  onRefreshWorker,
  onToggleWorker,
}: ExternalWorkerRowProps) => {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const manifest = getWorkerManifestView(worker.manifest, requestOrigin)
  const sourceListId = `external-worker-sources-${worker._id}`
  const isDown = worker.verificationStatus === WORKER_VERIFICATION_STATUS.down
  const isUsable = isWorkerUsable(worker)

  return (
    <div className="flex flex-col">
      <SettingsRow className="gap-4">
        <div className="-ml-1 flex min-w-0 items-center gap-3">
          <PluginIcon
            iconUrl={manifest.icon ?? undefined}
            fallback="extractor"
            className="size-10 text-foreground"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm text-foreground">
                {manifest.name}
              </span>
              {isDown && <Badge variant="destructive">Down</Badge>}
            </div>
            <span
              className="truncate font-mono text-xs text-muted-foreground"
              title={worker.baseUrl}
            >
              {worker.baseUrl}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Switch
            checked={isUsable}
            disabled={isDown}
            onCheckedChange={() => onToggleWorker(worker._id, worker.enabled)}
            aria-label={
              isDown
                ? `${manifest.name} is down`
                : `${worker.enabled ? "Disable" : "Enable"} ${manifest.name}`
            }
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  aria-label={`Actions for ${manifest.name}`}
                />
              }
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onRefreshWorker(worker._id)}>
                  <HugeiconsIcon icon={Refresh01Icon} />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDeleteWorker(worker._id)}
                >
                  <HugeiconsIcon icon={Delete02Icon} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {manifest.plugins.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label={
                isExpanded
                  ? "Collapse extractor sources"
                  : "Expand extractor sources"
              }
              aria-expanded={isExpanded}
              aria-controls={sourceListId}
              onClick={() => setIsExpanded((current) => !current)}
            >
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className={cn(
                  "transition-transform duration-200",
                  isExpanded ? "rotate-180" : "rotate-0"
                )}
              />
            </Button>
          )}
        </div>
      </SettingsRow>

      {manifest.plugins.length > 0 && isExpanded && (
        <div
          id={sourceListId}
          className="ml-9 divide-y divide-border border-t border-border"
        >
          {manifest.plugins.map((source) => (
            <SettingsRow key={source.id} className="gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <PluginIcon
                  iconUrl={source.iconUrl}
                  fallback="source"
                  className="size-10"
                />
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm text-foreground">
                    {source.displayName}
                  </span>
                  {(source.homepage || source.hosts[0]) && (
                    <a
                      href={
                        source.homepage ??
                        `https://${source.hosts[0] as string}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View upstream project for ${source.displayName}`}
                      title="View upstream project"
                      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <HugeiconsIcon
                        icon={LinkSquare02Icon}
                        className="size-4"
                      />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pr-1">
                {(source.status === "down" ||
                  source.status === "maintenance") && (
                  <Badge variant={sourceStatusVariant(source.status)}>
                    {source.status}
                  </Badge>
                )}
                {source.version && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    v{source.version}
                  </span>
                )}
              </div>
            </SettingsRow>
          ))}
        </div>
      )}
    </div>
  )
}

export const ExternalWorkerTable = ({
  workers,
  requestOrigin,
  onDeleteWorker,
  onRefreshWorker,
  onToggleWorker,
}: {
  workers: ExtractorWorker[]
  requestOrigin: string
  onDeleteWorker: (workerId: string) => void
  onRefreshWorker: (workerId: string) => void
  onToggleWorker: (workerId: string, currentEnabled: boolean) => void
}) => (
  <SettingsList>
    {workers.map((worker) => (
      <ExternalWorkerRow
        key={worker._id}
        worker={worker}
        requestOrigin={requestOrigin}
        onDeleteWorker={onDeleteWorker}
        onRefreshWorker={onRefreshWorker}
        onToggleWorker={onToggleWorker}
      />
    ))}
  </SettingsList>
)
