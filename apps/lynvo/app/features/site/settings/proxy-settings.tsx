import {
  Add01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  Key01Icon,
  MoreHorizontalIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"
import { Link } from "react-router"

import { ScrapeDoMark } from "~/components/brand-marks"
import { FormDialogContent } from "~/components/form-dialog-content"
import { FormDialogInput } from "~/components/form-dialog-input"
import { PluginServerAvatar } from "~/components/plugin-icon"
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
import type { ProxyProviderState } from "~/lib/api-contracts"
import { PLUGIN_SERVER_VERIFICATION_STATUS } from "~/lib/effect/services/plugin-server-verification-status"
import { isSupportedProxyProvider } from "~/lib/plugin-server-proxy"

import { getPluginServerManifestView } from "./plugin-server-manifest"
import type { CustomPluginServer } from "./plugin-settings-interaction"
import {
  SectionHeading,
  SettingsHeadingText,
  SettingsList,
  SettingsPanel,
  SettingsRow,
  SettingsUsageMeter,
} from "./settings-layout"
import { useProxySettings } from "./use-proxy-settings"

const BALANCE_FORMATTER = new Intl.NumberFormat()
const CHECKED_AT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

const formatCheckedAt = (timestamp: number) =>
  CHECKED_AT_FORMATTER.format(new Date(timestamp))

interface ProxySettingsProps {
  readonly requestOrigin: string
}

export function ProxySettings({ requestOrigin }: ProxySettingsProps) {
  const {
    pluginServers,
    proxyProvider,
    proxyProviderIsLoading,
    setProxyProviderKey,
    handleTogglePluginServerProxy,
    refreshProxyProviderBalance,
    serverOperations,
  } = useProxySettings()
  const proxyServers = React.useMemo(
    () =>
      pluginServers.flatMap((pluginServer) => {
        const manifest = getPluginServerManifestView(
          pluginServer.manifest,
          requestOrigin
        )
        return isSupportedProxyProvider(manifest.proxyProvider)
          ? [{ manifest, pluginServer }]
          : []
      }),
    [pluginServers, requestOrigin]
  )

  return (
    <SettingsPanel className="gap-8">
      <div className="flex flex-col gap-3">
        <SectionHeading
          title="Proxy providers"
          description="Save one API token per provider. Lynvo encrypts it and sends it only to servers whose proxy switch is on."
          size="base"
          descriptionSize="sm"
        />
        <SettingsList>
          <ProxyProviderRow
            state={proxyProvider}
            isLoading={proxyProviderIsLoading}
            isKeyBusy={
              serverOperations["proxy-key:scrape-do"]?.status === "pending"
            }
            isRefreshingCredits={
              serverOperations["proxy-balance:scrape-do"]?.status === "pending"
            }
            onSetProxyKey={setProxyProviderKey}
            onRefreshCredits={() => {
              void refreshProxyProviderBalance()
            }}
          />
        </SettingsList>
      </div>
      <div className="flex flex-col gap-3">
        <SectionHeading
          title="Servers"
          description="Turn the proxy on for each supported Custom Plugin Server that should use your key during Extraction."
          size="base"
          descriptionSize="sm"
        />
        {proxyServers.length === 0 ? (
          <SettingsRow className="items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-base text-foreground">
                No supported Custom Plugin Servers
              </p>
              <p className="text-base leading-normal text-muted-foreground">
                Connect a Custom Plugin Server that declares Scrape.do proxy
                support to use your key here.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link prefetch="intent" to="/settings/plugins" />}
            >
              Open Plugins
            </Button>
          </SettingsRow>
        ) : (
          <SettingsList>
            {proxyServers.map(({ manifest, pluginServer }) => (
              <ProxyServerRow
                key={pluginServer.id}
                manifest={manifest}
                pluginServer={pluginServer}
                hasProxyKey={proxyProvider.hasKey}
                isToggling={
                  serverOperations[`proxy-toggle:${pluginServer.id}`]
                    ?.status === "pending"
                }
                onToggleProxy={handleTogglePluginServerProxy}
              />
            ))}
          </SettingsList>
        )}
      </div>
      <p className="text-xs leading-normal text-muted-foreground">
        <Link
          prefetch="intent"
          to="/docs/proxy-keys"
          className="text-foreground underline underline-offset-4"
        >
          Learn about proxy keys
        </Link>{" "}
        and when to use them.
      </p>
    </SettingsPanel>
  )
}

interface ProxyServerRowProps {
  readonly manifest: ReturnType<typeof getPluginServerManifestView>
  readonly pluginServer: CustomPluginServer
  readonly hasProxyKey: boolean
  readonly isToggling: boolean
  readonly onToggleProxy: (
    pluginServerId: string,
    currentEnabled: boolean
  ) => void
}

const ProxyServerRow = ({
  manifest,
  pluginServer,
  hasProxyKey,
  isToggling,
  onToggleProxy,
}: ProxyServerRowProps) => {
  const isDown =
    pluginServer.verificationStatus === PLUGIN_SERVER_VERIFICATION_STATUS.down
  const isProxyEnabled = hasProxyKey && pluginServer.proxyEnabled

  return (
    <SettingsRow className="gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PluginServerAvatar
          serverId={pluginServer.id}
          name={manifest.name}
          className="size-12"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <SettingsHeadingText as="h3" className="truncate">
            {manifest.name}
          </SettingsHeadingText>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Switch
          checked={isProxyEnabled}
          disabled={!hasProxyKey || isDown || isToggling}
          onCheckedChange={() =>
            onToggleProxy(pluginServer.id, pluginServer.proxyEnabled)
          }
          aria-busy={isToggling}
          aria-label={`Use proxy for ${manifest.name}`}
        />
      </div>
    </SettingsRow>
  )
}

interface ProxyProviderRowProps {
  readonly state: ProxyProviderState
  readonly isLoading: boolean
  readonly isKeyBusy: boolean
  readonly isRefreshingCredits: boolean
  readonly onSetProxyKey: (token: string) => Promise<boolean>
  readonly onRefreshCredits: () => void
}

const ProxyProviderRow = ({
  state: { hasKey, balanceRemaining, balanceLimit, balanceCheckedAt },
  isLoading,
  isKeyBusy,
  isRefreshingCredits,
  onSetProxyKey,
  onRefreshCredits,
}: ProxyProviderRowProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isKeyDialogOpen, setIsKeyDialogOpen] = React.useState(false)
  const detailsId = React.useId()
  const hasCredits =
    hasKey && balanceRemaining !== null && balanceLimit !== null
  const keyStatusLabel = isLoading ? "Checking saved key…" : undefined
  const usedCredits = hasCredits
    ? Math.max(balanceLimit - balanceRemaining, 0)
    : 0
  const usedPercent =
    hasCredits && balanceLimit > 0
      ? Math.min(Math.round((usedCredits / balanceLimit) * 100), 100)
      : 0

  return (
    <div className="flex flex-col">
      <SettingsRow className="flex-col items-stretch gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center">
              <ScrapeDoMark className="size-8" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <SettingsHeadingText as="h3">Scrape.do</SettingsHeadingText>
              {keyStatusLabel !== undefined && (
                <span className="text-base text-muted-foreground">
                  {keyStatusLabel}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasKey && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      disabled={isKeyBusy}
                      aria-busy={isKeyBusy}
                      aria-label="Scrape.do key actions"
                    />
                  }
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setIsKeyDialogOpen(true)}>
                      <HugeiconsIcon icon={Key01Icon} />
                      Change key
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={isKeyBusy}
                      onClick={() => {
                        void onSetProxyKey("")
                      }}
                    >
                      <HugeiconsIcon icon={Delete02Icon} />
                      Remove key
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!hasKey && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isKeyBusy}
                aria-busy={isKeyBusy}
                aria-label="Add Scrape.do key"
                onClick={() => setIsKeyDialogOpen(true)}
              >
                <HugeiconsIcon icon={Add01Icon} />
              </Button>
            )}
            <ProxyKeyDialog
              open={isKeyDialogOpen}
              onOpenChange={setIsKeyDialogOpen}
              onSetProxyKey={onSetProxyKey}
            />
            {hasKey && (
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label={`${isExpanded ? "Collapse" : "Expand"} Scrape.do usage`}
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                onClick={() => setIsExpanded((current) => !current)}
              >
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className={`transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : "rotate-0"
                  }`}
                />
              </Button>
            )}
          </div>
        </div>
      </SettingsRow>
      <div
        id={detailsId}
        className={
          hasKey && isExpanded
            ? "ms-15 flex flex-col gap-2 border-t border-border pb-4"
            : "hidden"
        }
      >
        {hasKey &&
          (hasCredits ? (
            <SettingsUsageMeter
              title={
                <SettingsHeadingText as="h4">
                  Monthly credit usage
                </SettingsHeadingText>
              }
              trailing={`${BALANCE_FORMATTER.format(usedPercent)}% used`}
              progress={{
                value: usedPercent,
                label: "Scrape.do monthly credits used",
              }}
              footer={
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span>
                    {BALANCE_FORMATTER.format(usedCredits)} of{" "}
                    {BALANCE_FORMATTER.format(balanceLimit)} credits used
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {balanceCheckedAt !== null && (
                      <span>
                        Checked{" "}
                        <time
                          dateTime={new Date(balanceCheckedAt).toISOString()}
                        >
                          {formatCheckedAt(balanceCheckedAt)}
                        </time>
                      </span>
                    )}
                    <RefreshCreditsButton
                      isRefreshing={isRefreshingCredits}
                      onRefresh={onRefreshCredits}
                    />
                  </div>
                </div>
              }
            />
          ) : (
            <SettingsUsageMeter
              title={
                <span className="text-base text-muted-foreground">
                  Monthly credit usage is unavailable.
                </span>
              }
              trailing={
                <RefreshCreditsButton
                  isRefreshing={isRefreshingCredits}
                  onRefresh={onRefreshCredits}
                />
              }
            />
          ))}
      </div>
    </div>
  )
}

interface RefreshCreditsButtonProps {
  readonly isRefreshing: boolean
  readonly onRefresh: () => void
}

const RefreshCreditsButton = ({
  isRefreshing,
  onRefresh,
}: RefreshCreditsButtonProps) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className="size-8"
    disabled={isRefreshing}
    onClick={onRefresh}
    aria-busy={isRefreshing}
    aria-label="Refresh Scrape.do credits"
  >
    <HugeiconsIcon
      icon={Refresh01Icon}
      className={
        isRefreshing ? "animate-spin motion-reduce:animate-none" : undefined
      }
    />
  </Button>
)

interface ProxyKeyDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSetProxyKey: (token: string) => Promise<boolean>
}

const ProxyKeyDialog = ({
  open,
  onOpenChange,
  onSetProxyKey,
}: ProxyKeyDialogProps) => {
  const [token, setToken] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const inputId = React.useId()

  const reset = () => {
    setToken("")
    setIsSaving(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          reset()
        }
      }}
    >
      <FormDialogContent
        title="Scrape.do proxy key"
        description="Lynvo encrypts this key and sends it only to servers whose proxy switch is on during Extraction."
        media={<ScrapeDoMark className="mx-auto size-14 shrink-0" />}
        submitLabel="Save key"
        submitPending={isSaving}
        submitDisabled={isSaving}
        cancelDisabled={isSaving}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (event) => {
          event.preventDefault()
          setIsSaving(true)
          const didSave = await onSetProxyKey(token)
          if (didSave) {
            onOpenChange(false)
            reset()
          } else {
            setIsSaving(false)
          }
        }}
      >
        <FormDialogInput
          id={inputId}
          label="Scrape.do API token"
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="new-password"
          required
          autoFocus
        />
      </FormDialogContent>
    </Dialog>
  )
}
