import {
  Add01Icon,
  Delete02Icon,
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
import { Dialog, DialogTrigger } from "~/components/ui/dialog"
import { Progress } from "~/components/ui/progress"
import { Switch } from "~/components/ui/switch"
import type { ProxyProviderState } from "~/lib/api-contracts"
import { PLUGIN_SERVER_VERIFICATION_STATUS } from "~/lib/effect/services/plugin-server-verification-status"
import { isSupportedProxyProvider } from "~/lib/plugin-server-proxy"

import { getPluginServerManifestView } from "./plugin-server-manifest"
import {
  usePluginSettingsInteraction,
  type CustomPluginServer,
} from "./plugin-settings-interaction"
import {
  SectionHeading,
  SettingsList,
  SettingsPanel,
  SettingsRow,
} from "./settings-layout"

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
  } = usePluginSettingsInteraction()
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
        />
        {proxyServers.length === 0 ? (
          <SettingsRow className="items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm text-foreground">
                No supported Custom Plugin Servers
              </p>
              <p className="text-xs leading-normal text-muted-foreground">
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
  const proxySwitchId = React.useId()

  return (
    <SettingsRow className="gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PluginServerAvatar
          serverId={pluginServer.id}
          name={manifest.name}
          className="size-10"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm text-foreground">
            {manifest.name}
          </span>
          <span
            className="truncate font-mono text-xs text-muted-foreground"
            title={pluginServer.baseUrl}
          >
            {pluginServer.baseUrl}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label
          htmlFor={proxySwitchId}
          className="text-xs text-muted-foreground"
        >
          Use proxy <span className="sr-only">for {manifest.name}</span>
        </label>
        <Switch
          id={proxySwitchId}
          checked={isProxyEnabled}
          disabled={!hasProxyKey || isDown || isToggling}
          onCheckedChange={() =>
            onToggleProxy(pluginServer.id, pluginServer.proxyEnabled)
          }
          aria-busy={isToggling}
        />
      </div>
    </SettingsRow>
  )
}

const readProxyKeyStatusLabel = ({
  hasKey,
  isLoading,
}: {
  readonly hasKey: boolean
  readonly isLoading: boolean
}): string | undefined => {
  if (isLoading) {
    return "Checking saved key…"
  }
  return hasKey ? "Key saved" : undefined
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
  const hasCredits =
    hasKey && balanceRemaining !== null && balanceLimit !== null
  const keyStatusLabel = readProxyKeyStatusLabel({ hasKey, isLoading })
  const usedCredits = hasCredits
    ? Math.max(balanceLimit - balanceRemaining, 0)
    : 0
  const usedPercent =
    hasCredits && balanceLimit > 0
      ? Math.min(Math.round((usedCredits / balanceLimit) * 100), 100)
      : 0

  return (
    <SettingsRow className="flex-col items-stretch gap-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <ScrapeDoMark className="size-9 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm text-foreground">Scrape.do</span>
            {keyStatusLabel !== undefined && (
              <span className="text-xs text-muted-foreground">
                {keyStatusLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasKey && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={isKeyBusy}
              aria-busy={isKeyBusy}
              aria-label="Remove Scrape.do key"
              onClick={() => {
                void onSetProxyKey("")
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          )}
          <ProxyKeyDialog hasProxyKey={hasKey} onSetProxyKey={onSetProxyKey} />
        </div>
      </div>
      {hasKey &&
        (hasCredits ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-base font-normal text-foreground">
                Monthly credit usage
              </span>
              <span className="flex shrink-0 items-center gap-2 text-base font-normal tabular-nums text-foreground">
                {BALANCE_FORMATTER.format(usedPercent)}% used
                <RefreshCreditsButton
                  isRefreshing={isRefreshingCredits}
                  onRefresh={onRefreshCredits}
                />
              </span>
            </div>
            <Progress
              value={usedPercent}
              aria-label="Scrape.do monthly credits used"
            />
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">
                {BALANCE_FORMATTER.format(usedCredits)} of{" "}
                {BALANCE_FORMATTER.format(balanceLimit)} credits used
              </span>
              {balanceCheckedAt !== null && (
                <span className="text-sm text-muted-foreground">
                  Checked{" "}
                  <time dateTime={new Date(balanceCheckedAt).toISOString()}>
                    {formatCheckedAt(balanceCheckedAt)}
                  </time>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Monthly credit usage is unavailable.
            </span>
            <RefreshCreditsButton
              isRefreshing={isRefreshingCredits}
              onRefresh={onRefreshCredits}
            />
          </div>
        ))}
    </SettingsRow>
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
  readonly hasProxyKey: boolean
  readonly onSetProxyKey: (token: string) => Promise<boolean>
}

const ProxyKeyDialog = ({
  hasProxyKey,
  onSetProxyKey,
}: ProxyKeyDialogProps) => {
  const [open, setOpen] = React.useState(false)
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
        setOpen(nextOpen)
        if (!nextOpen) {
          reset()
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant={hasProxyKey ? "ghost" : "outline"}
            size={hasProxyKey ? "sm" : "icon-sm"}
            aria-label={`${hasProxyKey ? "Change" : "Add"} Scrape.do key`}
          >
            {hasProxyKey ? "Change key" : <HugeiconsIcon icon={Add01Icon} />}
          </Button>
        }
      />
      <FormDialogContent
        title="Scrape.do proxy key"
        description="Lynvo encrypts this key and sends it only to servers whose proxy switch is on during Extraction."
        media={<ScrapeDoMark className="mx-auto size-14 shrink-0" />}
        submitLabel="Save key"
        submitPending={isSaving}
        submitDisabled={isSaving}
        cancelDisabled={isSaving}
        onSubmit={async (event) => {
          event.preventDefault()
          setIsSaving(true)
          const didSave = await onSetProxyKey(token)
          if (didSave) {
            setOpen(false)
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
