import * as React from "react"
import { Link } from "react-router"
import { Key01Icon, Refresh01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "~/components/ui/button"
import { FormDialogContent } from "~/components/form-dialog-content"
import { FormDialogInput } from "~/components/form-dialog-input"
import { Dialog, DialogTrigger } from "~/components/ui/dialog"
import { Badge } from "~/components/ui/badge"
import { Switch } from "~/components/ui/switch"
import { PluginIcon } from "~/components/plugin-icon"
import { isSupportedProxyProvider } from "~/lib/plugin-server-proxy"
import {
  SectionHeading,
  SettingsList,
  SettingsPanel,
  SettingsRow,
} from "./settings-layout"
import {
  usePluginSettingsInteraction,
  type CustomPluginServer,
} from "./plugin-settings-interaction"
import { getPluginServerManifestView } from "./plugin-server-manifest"
import { PLUGIN_SERVER_VERIFICATION_STATUS } from "~/lib/effect/services/plugin-server-verification-status"

const BALANCE_FORMATTER = new Intl.NumberFormat()
const CHECKED_AT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

const formatBalance = (remaining: number, limit: number) =>
  `${BALANCE_FORMATTER.format(remaining)} of ${BALANCE_FORMATTER.format(limit)} credits remaining`

const formatCheckedAt = (timestamp: number) =>
  CHECKED_AT_FORMATTER.format(new Date(timestamp))

const getProxyDescription = (hasProxyKey: boolean, isProxyEnabled: boolean) => {
  if (!hasProxyKey) {
    return "Add a proxy key before turning this on."
  }
  if (isProxyEnabled) {
    return "Extractions can use your Scrape.do credits."
  }
  return "Extractions use the Custom Plugin Server’s own proxy behavior."
}

const getBalanceDescription = ({
  hasProxyKey,
  remaining,
  limit,
}: {
  readonly hasProxyKey: boolean
  readonly remaining?: number | null
  readonly limit?: number | null
}) => {
  if (
    remaining !== null &&
    remaining !== undefined &&
    limit !== null &&
    limit !== undefined
  ) {
    return formatBalance(remaining, limit)
  }
  if (hasProxyKey) {
    return "Not checked yet"
  }
  return "Add a proxy key to check balance"
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
          title="Proxy keys"
          description="Bring your own Scrape.do proxy key for supported Custom Plugin Servers. Lynvo stores the key encrypted and sends it only when you turn proxy use on."
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
              render={<Link to="/settings/plugins" />}
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
                onSetProxyKey={handleSetPluginServerProxyKey}
                onToggleProxy={handleTogglePluginServerProxy}
                onRefreshBalance={handleRefreshPluginServerProxyBalance}
                isToggling={
                  serverOperations[`proxy-toggle:${pluginServer.id}`]
                    ?.status === "pending"
                }
                isRefreshingBalance={
                  serverOperations[`proxy-balance:${pluginServer.id}`]
                    ?.status === "pending"
                }
              />
            ))}
          </SettingsList>
        )}
      </div>
      <p className="text-xs leading-normal text-muted-foreground">
        <Link
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
  readonly onRefreshBalance: (pluginServerId: string) => void
  readonly isToggling: boolean
  readonly isRefreshingBalance: boolean
}

const ProxyServerSettingsRow = ({
  manifest,
  pluginServer,
  onSetProxyKey,
  onToggleProxy,
  onRefreshBalance,
  isToggling,
  isRefreshingBalance,
}: ProxyServerSettingsRowProps) => {
  const isDown =
    pluginServer.verificationStatus === PLUGIN_SERVER_VERIFICATION_STATUS.down
  const isProxyEnabled = pluginServer.hasProxyKey && pluginServer.proxyEnabled
  const proxyUsage = manifest.plugins.flatMap((source) =>
    source.proxyCreditUsage
      ? [{ name: source.displayName, usage: source.proxyCreditUsage }]
      : []
  )
  const proxyDescription = getProxyDescription(
    pluginServer.hasProxyKey,
    isProxyEnabled
  )
  const balanceDescription = getBalanceDescription({
    hasProxyKey: pluginServer.hasProxyKey,
    remaining: pluginServer.proxyBalanceRemaining,
    limit: pluginServer.proxyBalanceLimit,
  })

  return (
    <div className="flex min-w-0 flex-col gap-5 py-5 first:pt-4 last:pb-4">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
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
              <Badge variant="outline">Scrape.do</Badge>
            </div>
            <span
              className="truncate font-mono text-xs text-muted-foreground"
              title={pluginServer.baseUrl}
            >
              {pluginServer.baseUrl}
            </span>
          </div>
        </div>
        <ProxyKeyDialog
          pluginServer={pluginServer}
          serverName={manifest.name}
          onSetProxyKey={onSetProxyKey}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-muted/40 p-4">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm text-foreground">Use proxy key</p>
            <p className="text-xs leading-normal text-muted-foreground">
              {proxyDescription}
            </p>
          </div>
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

        <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-sm text-foreground">Balance</span>
            <span className="text-sm tabular-nums text-foreground">
              {balanceDescription}
            </span>
          </div>
          {pluginServer.proxyBalanceCheckedAt ? (
            <p className="text-xs text-muted-foreground">
              Checked{" "}
              <time
                dateTime={new Date(
                  pluginServer.proxyBalanceCheckedAt
                ).toISOString()}
              >
                {formatCheckedAt(pluginServer.proxyBalanceCheckedAt)}
              </time>
            </p>
          ) : null}
          {pluginServer.hasProxyKey ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={isRefreshingBalance}
              onClick={() => onRefreshBalance(pluginServer.id)}
              aria-busy={isRefreshingBalance}
            >
              <HugeiconsIcon
                icon={Refresh01Icon}
                data-icon="inline-start"
                className={
                  isRefreshingBalance
                    ? "animate-spin motion-reduce:animate-none"
                    : undefined
                }
              />
              Refresh balance
            </Button>
          ) : null}
        </div>

        {proxyUsage.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-border/60 pt-4">
            <p className="text-sm text-foreground">Proxy usage</p>
            <ul className="flex flex-col gap-1 text-xs leading-normal text-muted-foreground">
              {proxyUsage.map(({ name, usage }) => (
                <li key={name}>
                  <span className="text-foreground">{name}:</span> {usage}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface ProxyKeyDialogProps {
  readonly pluginServer: CustomPluginServer
  readonly serverName: string
  readonly onSetProxyKey: (
    pluginServerId: string,
    token: string
  ) => Promise<boolean>
}

const ProxyKeyDialog = ({
  pluginServer,
  serverName,
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
          <Button variant={pluginServer.hasProxyKey ? "outline" : "default"}>
            <HugeiconsIcon icon={Key01Icon} data-icon="inline-start" />
            {pluginServer.hasProxyKey ? "Change key" : "Add proxy key"}
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
