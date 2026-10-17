import { Key01Icon, Refresh01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"
import { Link } from "react-router"

import { FormDialogContent } from "~/components/form-dialog-content"
import { FormDialogInput } from "~/components/form-dialog-input"
import { PluginIcon } from "~/components/plugin-icon"
import { Button } from "~/components/ui/button"
import { Dialog, DialogTrigger } from "~/components/ui/dialog"
import { Progress } from "~/components/ui/progress"
import { Switch } from "~/components/ui/switch"
import { PLUGIN_SERVER_VERIFICATION_STATUS } from "~/lib/effect/services/plugin-server-verification-status"
import {
  getProxyProviderPresentation,
  isSupportedProxyProvider,
  SCRAPE_DO_PROXY_PROVIDER,
} from "~/lib/plugin-server-proxy"
import { cn } from "~/lib/utils"

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

const getProxyStateDescription = (
  hasProxyKey: boolean,
  isProxyEnabled: boolean
): string => {
  if (!hasProxyKey) {
    return "No proxy key saved for this server."
  }
  if (isProxyEnabled) {
    return "Extractions can use your proxy credits."
  }
  return "Proxy use is off for this server."
}

interface ProxyProviderCredits {
  readonly remaining: number
  readonly limit: number
  readonly checkedAt: number | null
}

// Balances are stored per server, but one provider key is what the user
// manages; the freshest check stands in for the provider account.
const readProviderCredits = (
  servers: readonly CustomPluginServer[]
): ProxyProviderCredits | undefined =>
  servers
    .filter(
      (pluginServer) =>
        pluginServer.hasProxyKey &&
        pluginServer.proxyBalanceRemaining !== null &&
        pluginServer.proxyBalanceRemaining !== undefined &&
        pluginServer.proxyBalanceLimit !== null &&
        pluginServer.proxyBalanceLimit !== undefined
    )
    .toSorted(
      (first, second) =>
        (second.proxyBalanceCheckedAt ?? 0) - (first.proxyBalanceCheckedAt ?? 0)
    )
    .map((pluginServer) => ({
      remaining: pluginServer.proxyBalanceRemaining ?? 0,
      limit: pluginServer.proxyBalanceLimit ?? 0,
      checkedAt: pluginServer.proxyBalanceCheckedAt ?? null,
    }))[0]

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
  const [proxyServers, proxyProvider] = React.useMemo(() => {
    const servers = pluginServers.flatMap((pluginServer) => {
      const manifest = getPluginServerManifestView(
        pluginServer.manifest,
        requestOrigin
      )
      return isSupportedProxyProvider(manifest.proxyProvider)
        ? [{ manifest, pluginServer }]
        : []
    })
    return [
      servers,
      getProxyProviderPresentation(SCRAPE_DO_PROXY_PROVIDER),
    ] as const
  }, [pluginServers, requestOrigin])

  const credits = readProviderCredits(
    proxyServers.map((entry) => entry.pluginServer)
  )
  const serversWithKeys = proxyServers.filter(
    ({ pluginServer }) => pluginServer.hasProxyKey
  )
  const isRefreshingCredits = serversWithKeys.some(
    ({ pluginServer }) =>
      serverOperations[`proxy-balance:${pluginServer.id}`]?.status === "pending"
  )
  const refreshCredits = () => {
    for (const { pluginServer } of serversWithKeys) {
      void handleRefreshPluginServerProxyBalance(pluginServer.id)
    }
  }
  const usedCredits =
    credits !== undefined ? Math.max(credits.limit - credits.remaining, 0) : 0
  const usedPercent =
    credits !== undefined && credits.limit > 0
      ? Math.min(Math.round((usedCredits / credits.limit) * 100), 100)
      : 0

  return (
    <SettingsPanel className="gap-8">
      <div className="flex flex-col gap-3">
        <SectionHeading
          title="Scrape.do proxy"
          description="Use your own proxy credits with supported Custom Plugin Servers. Lynvo stores the key encrypted and sends it only to the servers you turn on."
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
          proxyProvider !== undefined && (
            <div className="flex flex-col gap-5 rounded-2xl bg-muted/40 p-5">
              <div className="flex min-w-0 items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                      proxyProvider.markClassName
                    )}
                  >
                    {proxyProvider.monogram}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-normal text-foreground">
                      {proxyProvider.name}
                    </span>
                    <span className="text-xs leading-normal text-muted-foreground">
                      {proxyProvider.description}
                    </span>
                  </div>
                </div>
                {credits !== undefined && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    disabled={isRefreshingCredits}
                    onClick={refreshCredits}
                    aria-busy={isRefreshingCredits}
                  >
                    <HugeiconsIcon
                      icon={Refresh01Icon}
                      data-icon="inline-start"
                      className={
                        isRefreshingCredits
                          ? "animate-spin motion-reduce:animate-none"
                          : undefined
                      }
                    />
                    Refresh credits
                  </Button>
                )}
              </div>
              {credits !== undefined ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm text-foreground">
                      Credit usage
                    </span>
                    <span className="text-sm tabular-nums text-foreground">
                      {BALANCE_FORMATTER.format(usedCredits)} of{" "}
                      {BALANCE_FORMATTER.format(credits.limit)} credits used
                    </span>
                  </div>
                  <Progress
                    value={usedPercent}
                    aria-label={`${proxyProvider.name} credits used`}
                  />
                  <p className="text-xs text-muted-foreground">
                    <span>
                      {BALANCE_FORMATTER.format(credits.remaining)} credits
                      remaining
                    </span>
                    {credits.checkedAt !== null && (
                      <>
                        {" · Checked "}
                        <time
                          dateTime={new Date(credits.checkedAt).toISOString()}
                        >
                          {formatCheckedAt(credits.checkedAt)}
                        </time>
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-xs leading-normal text-muted-foreground">
                  Add a proxy key to a server below to see your credit usage.
                </p>
              )}
            </div>
          )
        )}
        {proxyServers.length > 0 && (
          <SettingsList>
            {proxyServers.map(({ manifest, pluginServer }) => (
              <ProxyServerSettingsRow
                key={pluginServer.id}
                manifest={manifest}
                pluginServer={pluginServer}
                onSetProxyKey={handleSetPluginServerProxyKey}
                onToggleProxy={handleTogglePluginServerProxy}
                isToggling={
                  serverOperations[`proxy-toggle:${pluginServer.id}`]
                    ?.status === "pending"
                }
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
  readonly onSetProxyKey: (
    pluginServerId: string,
    token: string
  ) => Promise<boolean>
  readonly onToggleProxy: (
    pluginServerId: string,
    currentEnabled: boolean
  ) => void
  readonly isToggling: boolean
}

const ProxyServerSettingsRow = ({
  manifest,
  pluginServer,
  onSetProxyKey,
  onToggleProxy,
  isToggling,
}: ProxyServerSettingsRowProps) => {
  const isDown =
    pluginServer.verificationStatus === PLUGIN_SERVER_VERIFICATION_STATUS.down
  const isProxyEnabled = pluginServer.hasProxyKey && pluginServer.proxyEnabled
  const proxyUsage = manifest.plugins.flatMap((source) =>
    source.proxyCreditUsage
      ? [{ name: source.displayName, usage: source.proxyCreditUsage }]
      : []
  )

  return (
    <SettingsRow className="gap-4 py-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PluginIcon
          iconUrl={manifest.icon ?? undefined}
          fallback="plugin-server"
          className="size-10 shrink-0 text-foreground"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm text-foreground">
            {manifest.name}
          </span>
          <span
            className="truncate font-mono text-xs text-muted-foreground"
            title={pluginServer.baseUrl}
          >
            {pluginServer.baseUrl}
          </span>
          <span className="text-xs leading-normal text-muted-foreground">
            {getProxyStateDescription(pluginServer.hasProxyKey, isProxyEnabled)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ProxyKeyDialog
          pluginServer={pluginServer}
          serverName={manifest.name}
          proxyUsage={proxyUsage}
          onSetProxyKey={onSetProxyKey}
        />
        <Switch
          checked={isProxyEnabled}
          disabled={!pluginServer.hasProxyKey || isDown || isToggling}
          onCheckedChange={() =>
            onToggleProxy(pluginServer.id, pluginServer.proxyEnabled)
          }
          aria-label={`${isProxyEnabled ? "Disable" : "Enable"} proxy for ${manifest.name}`}
          aria-busy={isToggling}
        />
      </div>
    </SettingsRow>
  )
}

interface ProxyKeyDialogProps {
  readonly pluginServer: CustomPluginServer
  readonly serverName: string
  readonly proxyUsage: readonly { name: string; usage: string }[]
  readonly onSetProxyKey: (
    pluginServerId: string,
    token: string
  ) => Promise<boolean>
}

const ProxyKeyDialog = ({
  pluginServer,
  serverName,
  proxyUsage,
  onSetProxyKey,
}: ProxyKeyDialogProps) => {
  const [open, setOpen] = React.useState(false)
  const [token, setToken] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)

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
            variant={pluginServer.hasProxyKey ? "ghost" : "outline"}
            size="icon"
            aria-label={
              pluginServer.hasProxyKey
                ? `Change proxy key for ${serverName}`
                : `Add proxy key for ${serverName}`
            }
          >
            <HugeiconsIcon icon={Key01Icon} />
          </Button>
        }
      />
      <FormDialogContent
        title={`Proxy key for ${serverName}`}
        description="Lynvo encrypts this key and sends it only to this Custom Plugin Server during Extraction. Scrape.do charges its proxy credits to your account."
        media={
          <HugeiconsIcon
            icon={Key01Icon}
            className="mx-auto size-16 text-muted-foreground"
          />
        }
        submitLabel="Save key"
        submitPending={isSaving}
        submitDisabled={isSaving}
        cancelDisabled={isSaving}
        onSubmit={async (event) => {
          event.preventDefault()
          setIsSaving(true)
          const didSave = await onSetProxyKey(pluginServer.id, token)
          if (didSave) {
            setOpen(false)
            reset()
          } else {
            setIsSaving(false)
          }
        }}
      >
        <FormDialogInput
          id={`proxy-key-${pluginServer.id}`}
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
        {proxyUsage.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-foreground">Proxy credit usage</p>
            <ul className="flex flex-col gap-1 text-xs leading-normal text-muted-foreground">
              {proxyUsage.map(({ name, usage }) => (
                <li key={name}>
                  <span className="text-foreground">{name}:</span> {usage}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {pluginServer.hasProxyKey ? (
          <Button
            type="button"
            variant="ghost"
            className="self-start text-muted-foreground"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true)
              const didRemove = await onSetProxyKey(pluginServer.id, "")
              if (didRemove) {
                setOpen(false)
                reset()
              } else {
                setIsSaving(false)
              }
            }}
          >
            Remove saved key
          </Button>
        ) : null}
      </FormDialogContent>
    </Dialog>
  )
}
