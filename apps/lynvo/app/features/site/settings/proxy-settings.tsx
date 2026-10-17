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

  const credits = readProviderCredits(
    proxyServers.map((entry) => entry.pluginServer)
  )
  const hasProxyKey = proxyServers.some(
    ({ pluginServer }) => pluginServer.hasProxyKey
  )
  const serversWithKeys = proxyServers.filter(
    ({ pluginServer }) => pluginServer.hasProxyKey
  )
  const isProxyKeyBusy = proxyServers.some(
    ({ pluginServer }) =>
      serverOperations[`proxy-key:${pluginServer.id}`]?.status === "pending"
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
  // One provider key covers every supported server, so the dialog saves or
  // removes the token on each of them instead of a single row.
  const setProviderKey = async (token: string): Promise<boolean> => {
    let didEverySaveSucceed = true
    for (const { pluginServer } of proxyServers) {
      // SAFETY: Key saves share the credential vault and the provider
      // balance endpoint, so they run one at a time instead of racing.
      // oxlint-disable-next-line eslint/no-await-in-loop
      const didSave = await handleSetPluginServerProxyKey(
        pluginServer.id,
        token
      )
      didEverySaveSucceed = didEverySaveSucceed && didSave
    }
    return didEverySaveSucceed
  }

  return (
    <SettingsPanel className="gap-8">
      <div className="flex flex-col gap-3">
        <SectionHeading
          title="Supported proxy"
          description="Use your own proxy credits with supported Custom Plugin Servers. Lynvo stores the key encrypted."
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
          <>
            <SettingsList>
              <SettingsRow className="flex-col items-stretch gap-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  {/* The wordmark is drawn for light surfaces, so it sits on
                      a white tile to stay legible in both themes. */}
                  <span className="flex h-11 shrink-0 items-center rounded-xl bg-white px-3">
                    <ScrapeDoLogo className="h-5 w-auto" />
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {hasProxyKey && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isProxyKeyBusy}
                        aria-busy={isProxyKeyBusy}
                        aria-label="Remove proxy key"
                        onClick={() => {
                          void setProviderKey("")
                        }}
                      >
                        <HugeiconsIcon icon={Delete02Icon} />
                      </Button>
                    )}
                    <ProxyKeyDialog
                      hasProxyKey={hasProxyKey}
                      onSetProxyKey={setProviderKey}
                    />
                  </div>
                </div>
                {credits !== undefined && (
                  // Part of the provider row, not a separate section, so no
                  // divider comes between the logo and the usage.
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-base font-normal text-foreground">
                        Monthly credit usage
                      </span>
                      <span className="shrink-0 text-base font-normal tabular-nums text-foreground">
                        {BALANCE_FORMATTER.format(usedPercent)}% used
                      </span>
                    </div>
                    <Progress
                      value={usedPercent}
                      aria-label="Scrape.do monthly credits used"
                    />
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">
                        {BALANCE_FORMATTER.format(usedCredits)} of{" "}
                        {BALANCE_FORMATTER.format(credits.limit)} credits used
                      </span>
                      {credits.checkedAt !== null && (
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          Checked{" "}
                          <time
                            dateTime={new Date(credits.checkedAt).toISOString()}
                          >
                            {formatCheckedAt(credits.checkedAt)}
                          </time>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={isRefreshingCredits}
                            onClick={refreshCredits}
                            aria-busy={isRefreshingCredits}
                            aria-label="Refresh credits"
                          >
                            <HugeiconsIcon
                              icon={Refresh01Icon}
                              className={
                                isRefreshingCredits
                                  ? "animate-spin motion-reduce:animate-none"
                                  : undefined
                              }
                            />
                          </Button>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </SettingsRow>
            </SettingsList>
            <SettingsList>
              {proxyServers.map(({ manifest, pluginServer }) => (
                <ProxyServerSettingsRow
                  key={pluginServer.id}
                  manifest={manifest}
                  pluginServer={pluginServer}
                  onToggleProxy={handleTogglePluginServerProxy}
                  isToggling={
                    serverOperations[`proxy-toggle:${pluginServer.id}`]
                      ?.status === "pending"
                  }
                />
              ))}
            </SettingsList>
          </>
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
  readonly onToggleProxy: (
    pluginServerId: string,
    currentEnabled: boolean
  ) => void
  readonly isToggling: boolean
}

const ProxyServerSettingsRow = ({
  manifest,
  pluginServer,
  onToggleProxy,
  isToggling,
}: ProxyServerSettingsRowProps) => {
  const isDown =
    pluginServer.verificationStatus === PLUGIN_SERVER_VERIFICATION_STATUS.down
  const isProxyEnabled = pluginServer.hasProxyKey && pluginServer.proxyEnabled

  return (
    <SettingsRow className="gap-4 py-4">
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
      <Switch
        checked={isProxyEnabled}
        disabled={!pluginServer.hasProxyKey || isDown || isToggling}
        onCheckedChange={() =>
          onToggleProxy(pluginServer.id, pluginServer.proxyEnabled)
        }
        aria-label={`${isProxyEnabled ? "Disable" : "Enable"} proxy for ${manifest.name}`}
        aria-busy={isToggling}
      />
    </SettingsRow>
  )
}

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
            size="icon"
            aria-label={hasProxyKey ? "Change proxy key" : "Add proxy key"}
          >
            <HugeiconsIcon icon={Add01Icon} />
          </Button>
        }
      />
      <FormDialogContent
        title="Scrape.do proxy key"
        description="Lynvo encrypts this key and sends it only to supported Custom Plugin Servers during Extraction."
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
          id="proxy-key-scrape-do"
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
