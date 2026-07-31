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
  isPluginServerUsable,
  PLUGIN_SERVER_VERIFICATION_STATUS,
} from "~/lib/effect/services/plugin-server-verification-status"
import { getPluginServerManifestView } from "./plugin-server-manifest"
import type { CustomPluginServer } from "./plugins-settings"
import { SettingsList, SettingsRow } from "./settings-layout"

interface CustomPluginServerRowProps {
  pluginServer: CustomPluginServer
  requestOrigin: string
  onDeletePluginServer: (pluginServerId: string) => void
  onRefreshPluginServer: (pluginServerId: string) => void
  onTogglePluginServer: (
    pluginServerId: string,
    currentEnabled: boolean
  ) => void
}

const CustomPluginServerRow = ({
  pluginServer,
  requestOrigin,
  onDeletePluginServer,
  onRefreshPluginServer,
  onTogglePluginServer,
}: CustomPluginServerRowProps) => {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const manifest = getPluginServerManifestView(
    pluginServer.manifest,
    requestOrigin
  )
  const sourceListId = `custom-plugin-server-sources-${pluginServer._id}`
  const isDown =
    pluginServer.verificationStatus === PLUGIN_SERVER_VERIFICATION_STATUS.down
  const isUsable = isPluginServerUsable(pluginServer)

  return (
    <div className="flex flex-col">
      <SettingsRow className="gap-4">
        <div className="-ml-1 flex min-w-0 items-center gap-3">
          <PluginIcon
            iconUrl={manifest.icon ?? undefined}
            fallback="plugin-server"
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
              title={pluginServer.baseUrl}
            >
              {pluginServer.baseUrl}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Switch
            checked={isUsable}
            disabled={isDown}
            onCheckedChange={() =>
              onTogglePluginServer(pluginServer._id, pluginServer.enabled)
            }
            aria-label={
              isDown
                ? `${manifest.name} is down`
                : `${pluginServer.enabled ? "Disable" : "Enable"} ${manifest.name}`
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
                <DropdownMenuItem
                  onClick={() => onRefreshPluginServer(pluginServer._id)}
                >
                  <HugeiconsIcon icon={Refresh01Icon} />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDeletePluginServer(pluginServer._id)}
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
              aria-label={isExpanded ? "Collapse plugins" : "Expand plugins"}
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

export const CustomPluginServerTable = ({
  pluginServers,
  requestOrigin,
  onDeletePluginServer,
  onRefreshPluginServer,
  onTogglePluginServer,
}: {
  pluginServers: CustomPluginServer[]
  requestOrigin: string
  onDeletePluginServer: (pluginServerId: string) => void
  onRefreshPluginServer: (pluginServerId: string) => void
  onTogglePluginServer: (
    pluginServerId: string,
    currentEnabled: boolean
  ) => void
}) => (
  <SettingsList>
    {pluginServers.map((pluginServer) => (
      <CustomPluginServerRow
        key={pluginServer._id}
        pluginServer={pluginServer}
        requestOrigin={requestOrigin}
        onDeletePluginServer={onDeletePluginServer}
        onRefreshPluginServer={onRefreshPluginServer}
        onTogglePluginServer={onTogglePluginServer}
      />
    ))}
  </SettingsList>
)
