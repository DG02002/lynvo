import {
  Alert01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"

import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { PluginIcon, PluginServerAvatar } from "~/components/plugin-icon"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Switch } from "~/components/ui/switch"
import {
  isPluginServerUsable,
  PLUGIN_SERVER_VERIFICATION_STATUS,
} from "~/lib/effect/services/plugin-server-verification-status"
import { sourceStatusVariant } from "~/lib/source-status-variant"

import { PluginInfoPopover } from "./plugin-info-popover"
import { getPluginServerManifestView } from "./plugin-server-manifest"
import type { CustomPluginServer } from "./plugin-settings-interaction"
import {
  SettingsHeadingText,
  SettingsDisclosure,
  SettingsList,
  SettingsRow,
} from "./settings-layout"

interface CustomPluginServerRowProps {
  pluginServer: CustomPluginServer
  requestOrigin: string
  onDeletePluginServer: (pluginServerId: string) => Promise<void>
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const manifest = getPluginServerManifestView(
    pluginServer.manifest,
    requestOrigin
  )
  const sourceListId = `custom-plugin-server-sources-${pluginServer.id}`
  const isDown =
    pluginServer.verificationStatus === PLUGIN_SERVER_VERIFICATION_STATUS.down
  const isUsable = isPluginServerUsable(pluginServer)

  return (
    <>
      <SettingsDisclosure
        label={`${manifest.name} plugins`}
        canExpand={manifest.plugins.length > 0}
        contentId={sourceListId}
        contentClassName="divide-y divide-border"
        renderHeader={(disclosureButton) => (
          <SettingsRow className="gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <PluginServerAvatar
                serverId={pluginServer.id}
                name={manifest.name}
                className="size-12"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <SettingsHeadingText as="h3" className="truncate">
                    {manifest.name}
                  </SettingsHeadingText>
                  {isDown && <Badge variant="destructive">Unavailable</Badge>}
                </div>
                <span
                  className="truncate text-sm text-muted-foreground"
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
                  onTogglePluginServer(pluginServer.id, pluginServer.enabled)
                }
                aria-label={
                  isDown
                    ? `${manifest.name} is unavailable`
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
                      onClick={() => onRefreshPluginServer(pluginServer.id)}
                    >
                      <HugeiconsIcon icon={Refresh01Icon} />
                      Refresh
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setIsDeleteDialogOpen(true)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {disclosureButton}
            </div>
          </SettingsRow>
        )}
      >
        {manifest.plugins.map((source) => {
          const projectUrl = source.homepage ?? source.hosts.at(0)
          return (
            <SettingsRow key={source.id} className="gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <PluginIcon iconUrl={source.iconUrl} className="size-10" />
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm text-foreground">
                    {source.displayName}
                  </span>
                  <PluginInfoPopover
                    pluginName={source.displayName}
                    description={source.description}
                    version={source.version}
                    usageMultiplier={source.usageMultiplier}
                    proxyCreditUsage={source.proxyCreditUsage}
                    projectUrl={
                      projectUrl &&
                      (source.homepage ? projectUrl : `https://${projectUrl}`)
                    }
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pr-1">
                {(source.status === "down" ||
                  source.status === "maintenance") && (
                  <Badge variant={sourceStatusVariant(source.status)}>
                    {source.status === "down" ? "Unavailable" : "Maintenance"}
                  </Badge>
                )}
              </div>
            </SettingsRow>
          )
        })}
      </SettingsDisclosure>
      <ConfirmationAlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete this Custom Plugin Server?"
        media={
          <HugeiconsIcon
            icon={Alert01Icon}
            className="mx-auto size-16 text-destructive"
          />
        }
        description={`${manifest.name} and its server connection will be removed. You can add it again later.`}
        confirmLabel="Delete server"
        confirmVariant="destructive"
        pending={isDeleting}
        onConfirm={() => {
          setIsDeleting(true)
          void onDeletePluginServer(pluginServer.id).finally(() => {
            setIsDeleting(false)
            setIsDeleteDialogOpen(false)
          })
        }}
      />
    </>
  )
}

export const CustomPluginServerTable = ({
  pluginServers,
  requestOrigin,
  onDeletePluginServer,
  onRefreshPluginServer,
  onTogglePluginServer,
}: {
  pluginServers: readonly CustomPluginServer[]
  requestOrigin: string
  onDeletePluginServer: (pluginServerId: string) => Promise<void>
  onRefreshPluginServer: (pluginServerId: string) => void
  onTogglePluginServer: (
    pluginServerId: string,
    currentEnabled: boolean
  ) => void
}) => (
  <SettingsList>
    {pluginServers.map((pluginServer) => (
      <CustomPluginServerRow
        key={pluginServer.id}
        pluginServer={pluginServer}
        requestOrigin={requestOrigin}
        onDeletePluginServer={onDeletePluginServer}
        onRefreshPluginServer={onRefreshPluginServer}
        onTogglePluginServer={onTogglePluginServer}
      />
    ))}
  </SettingsList>
)
