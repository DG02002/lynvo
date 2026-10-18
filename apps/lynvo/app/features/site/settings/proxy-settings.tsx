import {
  Add01Icon,
  Delete02Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"
import { Link } from "react-router"

import { ScrapeDoLogo } from "~/components/brand-marks"
import { FormDialogContent } from "~/components/form-dialog-content"
import { FormDialogInput } from "~/components/form-dialog-input"
import { PluginIcon } from "~/components/plugin-icon"
import { Button } from "~/components/ui/button"
import { Dialog, DialogTrigger } from "~/components/ui/dialog"
import { Progress } from "~/components/ui/progress"
import { Switch } from "~/components/ui/switch"
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

interface ProxyCredits {
  readonly remaining: number
  readonly limit: number
  readonly checkedAt: number | null
}

const readProxyCredits = (
  pluginServer: CustomPluginServer
): ProxyCredits | undefined => {
  const { proxyBalanceRemaining, proxyBalanceLimit, proxyBalanceCheckedAt } =
    pluginServer
  if (
    !pluginServer.hasProxyKey ||
    proxyBalanceRemaining === null ||
    proxyBalanceRemaining === undefined ||
    proxyBalanceLimit === null ||
    proxyBalanceLimit === undefined
  ) {
    return undefined
  }
  return {
    remaining: proxyBalanceRemaining,
    limit: proxyBalanceLimit,
    checkedAt: proxyBalanceCheckedAt ?? null,
  }
}

interface ProxySettingsProps {
  readonly requestOrigin: string
}

export function ProxySettings({ requestOrigin }: ProxySettingsProps) {
  const {
    pluginServers,
    handleSetPluginServerProxyKey,
    handleTogglePluginServerProxy,
    handleRefreshPluginServerProxyBalance,
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
          title="Supported proxy"
          description="Use your own Scrape.do credits with supported Custom Plugin Servers. Each server keeps its own encrypted key and proxy setting."
        />
        {proxyServers.length === 0 ? (
          <SettingsRow className="items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm text-foreground">
                No supported Custom Plugin Servers
              </p>
              <p className="text-xs leading-normal text-muted-foreground">
                Connect a Custom Plugin Server that declares Scrape.do proxy
                support to manage its proxy key here.
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
              <ProxyServerSettingsRow
                key={pluginServer.id}
                manifest={manifest}
                pluginServer={pluginServer}
                onToggleProxy={handleTogglePluginServerProxy}
                onSetProxyKey={(token) =>
                  handleSetPluginServerProxyKey(pluginServer.id, token)
                }
                onRefreshCredits={() =>
                  handleRefreshPluginServerProxyBalance(pluginServer.id)
                }
                operationStatus={{
                  isToggling:
                    serverOperations[`proxy-toggle:${pluginServer.id}`]
                      ?.status === "pending",
                  isProxyKeyBusy:
                    serverOperations[`proxy-key:${pluginServer.id}`]?.status ===
                    "pending",
                  isRefreshingCredits:
                    serverOperations[`proxy-balance:${pluginServer.id}`]
                      ?.status === "pending",
                }}
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

interface ProxyServerSettingsRowProps {
  readonly manifest: ReturnType<typeof getPluginServerManifestView>
  readonly pluginServer: CustomPluginServer
  readonly onSetProxyKey: (token: string) => Promise<boolean>
  readonly onRefreshCredits: () => void
  readonly onToggleProxy: (
    pluginServerId: string,
    currentEnabled: boolean
  ) => void
  readonly operationStatus: ProxyServerSettingsRowOperationStatus
}

interface ProxyServerSettingsRowOperationStatus {
  readonly isProxyKeyBusy: boolean
  readonly isRefreshingCredits: boolean
  readonly isToggling: boolean
}

const ProxyServerSettingsRow = ({
  manifest,
  pluginServer,
  onSetProxyKey,
  onRefreshCredits,
  onToggleProxy,
  operationStatus: { isProxyKeyBusy, isRefreshingCredits, isToggling },
}: ProxyServerSettingsRowProps) => {
  const isDown =
    pluginServer.verificationStatus === PLUGIN_SERVER_VERIFICATION_STATUS.down
  const isProxyEnabled = pluginServer.hasProxyKey && pluginServer.proxyEnabled
  const credits = readProxyCredits(pluginServer)
  const proxySwitchId = React.useId()
  const usedCredits =
    credits !== undefined ? Math.max(credits.limit - credits.remaining, 0) : 0
  const usedPercent =
    credits !== undefined && credits.limit > 0
      ? Math.min(Math.round((usedCredits / credits.limit) * 100), 100)
      : 0

  return (
    <SettingsRow className="flex-col items-stretch gap-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <PluginIcon
            iconUrl={manifest.icon ?? undefined}
            fallback="plugin-server"
            className="size-10 shrink-0 text-foreground"
          />
          <span className="truncate text-sm text-foreground">
            {manifest.name}
          </span>
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
            disabled={!pluginServer.hasProxyKey || isDown || isToggling}
            onCheckedChange={() =>
              onToggleProxy(pluginServer.id, pluginServer.proxyEnabled)
            }
            aria-busy={isToggling}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 shrink-0 items-center rounded-lg bg-white px-2.5">
            <ScrapeDoLogo className="h-4 w-auto" />
          </span>
          <span className="text-sm text-muted-foreground">
            {pluginServer.hasProxyKey ? "Key saved" : "No key saved"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {pluginServer.hasProxyKey && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={isProxyKeyBusy}
              aria-busy={isProxyKeyBusy}
              aria-label={`Remove Scrape.do key for ${manifest.name}`}
              onClick={() => {
                void onSetProxyKey("")
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          )}
          <ProxyKeyDialog
            pluginServerName={manifest.name}
            hasProxyKey={pluginServer.hasProxyKey}
            onSetProxyKey={onSetProxyKey}
          />
        </div>
      </div>
      {pluginServer.hasProxyKey && (
        <div className="flex flex-col gap-3">
          {credits === undefined ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">
                Monthly credit usage is unavailable.
              </span>
              <RefreshCreditsButton
                pluginServerName={manifest.name}
                isRefreshing={isRefreshingCredits}
                onRefresh={onRefreshCredits}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <span className="text-base font-normal text-foreground">
                  Monthly credit usage
                </span>
                <span className="flex shrink-0 items-center gap-2 text-base font-normal tabular-nums text-foreground">
                  {BALANCE_FORMATTER.format(usedPercent)}% used
                  <RefreshCreditsButton
                    pluginServerName={manifest.name}
                    isRefreshing={isRefreshingCredits}
                    onRefresh={onRefreshCredits}
                  />
                </span>
              </div>
              <Progress
                value={usedPercent}
                aria-label={`${manifest.name} monthly credits used`}
              />
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  {BALANCE_FORMATTER.format(usedCredits)} of{" "}
                  {BALANCE_FORMATTER.format(credits.limit)} credits used
                </span>
                {credits.checkedAt !== null && (
                  <span className="text-sm text-muted-foreground">
                    Checked{" "}
                    <time dateTime={new Date(credits.checkedAt).toISOString()}>
                      {formatCheckedAt(credits.checkedAt)}
                    </time>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </SettingsRow>
  )
}

interface RefreshCreditsButtonProps {
  readonly pluginServerName: string
  readonly isRefreshing: boolean
  readonly onRefresh: () => void
}

const RefreshCreditsButton = ({
  pluginServerName,
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
    aria-label={`Refresh credits for ${pluginServerName}`}
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
  readonly pluginServerName: string
  readonly hasProxyKey: boolean
  readonly onSetProxyKey: (token: string) => Promise<boolean>
}

const ProxyKeyDialog = ({
  pluginServerName,
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
            size="sm"
            aria-label={`${hasProxyKey ? "Change" : "Add"} Scrape.do key for ${pluginServerName}`}
          >
            {!hasProxyKey && <HugeiconsIcon icon={Add01Icon} />}
            {hasProxyKey ? "Change key" : "Add key"}
          </Button>
        }
      />
      <FormDialogContent
        title={`Scrape.do proxy key for ${pluginServerName}`}
        description="Lynvo encrypts this key and sends it only to this server during Extraction."
        media={
          <span className="mx-auto flex h-16 items-center rounded-2xl bg-white px-4">
            <ScrapeDoLogo className="h-7 w-auto" />
          </span>
        }
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
