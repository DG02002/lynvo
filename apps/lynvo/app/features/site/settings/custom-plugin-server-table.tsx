import * as React from "react"
import {
  Alert01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  Key01Icon,
  MoreHorizontalIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "~/components/ui/badge"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { FormDialogContent } from "~/components/form-dialog-content"
import { FormDialogInput } from "~/components/form-dialog-input"
import { PluginIcon } from "~/components/plugin-icon"
import { Button } from "~/components/ui/button"
import { Dialog } from "~/components/ui/dialog"
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
import { PluginInfoTooltip } from "./plugin-info-tooltip"
import type { CustomPluginServer } from "./plugin-settings-interaction"
import { SettingsList, SettingsRow } from "./settings-layout"

interface CustomPluginServerRowProps {
  pluginServer: CustomPluginServer
  requestOrigin: string
  onDeletePluginServer: (pluginServerId: string) => Promise<void>
  onRefreshPluginServer: (pluginServerId: string) => void
  onSetProxyKey: (pluginServerId: string, token: string) => Promise<boolean>
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
  onSetProxyKey,
  onTogglePluginServer,
}: CustomPluginServerRowProps) => {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isProxyDialogOpen, setIsProxyDialogOpen] = React.useState(false)
  const [proxyToken, setProxyToken] = React.useState("")
  const [isSavingProxyKey, setIsSavingProxyKey] = React.useState(false)
  const manifest = getPluginServerManifestView(
    pluginServer.manifest,
    requestOrigin
  )
  const sourceListId = `custom-plugin-server-sources-${pluginServer.id}`
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
              {isDown && <Badge variant="destructive">Unavailable</Badge>}
            </div>
            <span
              className="truncate font-mono text-xs text-muted-foreground"
              title={pluginServer.baseUrl}
            >
              {pluginServer.baseUrl}
            </span>
            {pluginServer.hasProxyKey &&
              pluginServer.proxyBalanceRemaining !== null &&
              pluginServer.proxyBalanceRemaining !== undefined && (
                <span className="truncate text-xs text-muted-foreground">
                  Own proxy key · {pluginServer.proxyBalanceRemaining} credits
                  left
                </span>
              )}
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
                {manifest.proxyProvider === "scrape-do" && (
                  <DropdownMenuItem onClick={() => setIsProxyDialogOpen(true)}>
                    <HugeiconsIcon icon={Key01Icon} />
                    Proxy key
                  </DropdownMenuItem>
                )}
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
          {manifest.plugins.map((source) => {
            const projectUrl = source.homepage ?? source.hosts.at(0)
            return (
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
                    <PluginInfoTooltip
                      pluginName={source.displayName}
                      description={source.description}
                      version={source.version}
                      usageMultiplier={source.usageMultiplier}
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
        </div>
      )}
      {manifest.proxyProvider === "scrape-do" && (
        <Dialog open={isProxyDialogOpen} onOpenChange={setIsProxyDialogOpen}>
          <FormDialogContent
            title={`Proxy key for ${manifest.name}`}
            description="Your Scrape.do API token is sent only to this Plugin Server on extraction, so proxy usage bills your own Scrape.do account instead of the shared pool."
            media={
              <HugeiconsIcon
                icon={Key01Icon}
                className="mx-auto size-16 text-muted-foreground"
              />
            }
            submitLabel="Save key"
            onSubmit={async () => {
              setIsSavingProxyKey(true)
              const didSave = await onSetProxyKey(pluginServer.id, proxyToken)
              setIsSavingProxyKey(false)
              if (didSave) {
                setProxyToken("")
                setIsProxyDialogOpen(false)
              }
            }}
          >
            <FormDialogInput
              id={`proxy-key-${pluginServer.id}`}
              label="Scrape.do API token"
              type="password"
              value={proxyToken}
              onChange={(event) => setProxyToken(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            {pluginServer.hasProxyKey && (
              <Button
                type="button"
                variant="ghost"
                className="self-start text-muted-foreground"
                disabled={isSavingProxyKey}
                onClick={async () => {
                  setIsSavingProxyKey(true)
                  const didRemove = await onSetProxyKey(pluginServer.id, "")
                  setIsSavingProxyKey(false)
                  if (didRemove) {
                    setProxyToken("")
                    setIsProxyDialogOpen(false)
                  }
                }}
              >
                Remove saved key
              </Button>
            )}
          </FormDialogContent>
        </Dialog>
      )}
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
    </div>
  )
}

export const CustomPluginServerTable = ({
  pluginServers,
  requestOrigin,
  onDeletePluginServer,
  onRefreshPluginServer,
  onSetProxyKey,
  onTogglePluginServer,
}: {
  pluginServers: readonly CustomPluginServer[]
  requestOrigin: string
  onDeletePluginServer: (pluginServerId: string) => Promise<void>
  onRefreshPluginServer: (pluginServerId: string) => void
  onSetProxyKey: (pluginServerId: string, token: string) => Promise<boolean>
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
        onSetProxyKey={onSetProxyKey}
        onTogglePluginServer={onTogglePluginServer}
      />
    ))}
  </SettingsList>
)
