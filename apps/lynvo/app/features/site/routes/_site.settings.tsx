import * as React from "react"
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity03Icon,
  HardDriveIcon,
  Key01Icon,
  PlayIcon,
  Plug02Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { GeneralSettings } from "~/features/site/settings/general-settings"
import { PlayerSettings } from "~/features/site/settings/player-settings"
import { PluginsSettings } from "~/features/site/settings/plugins-settings"
import { SecuritySettings } from "~/features/site/settings/security-settings"
import { StorageSettings } from "~/features/site/settings/storage-settings"
import { UsageSettings } from "~/features/site/settings/usage-settings"
import {
  getUserSession,
  responseWithSession,
  requireUserOrRedirect,
} from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import { loadOfficialPlugins } from "~/features/site/settings/official-plugin-catalog.server"
import {
  getLegacySettingsPath,
  getSettingsPath,
  parseSettingsRoute,
  type SettingsTab,
} from "~/features/site/settings/settings-route"

export function meta() {
  return [{ title: "Settings | Lynvo" }]
}

export async function loader(args: LoaderFunctionArgs): Promise<any> {
  const request = args.request
  const env = getServerEnv(args.context)
  const sessionResult = await getUserSession(request, env)

  const pathname = new URL(request.url).pathname
  requireUserOrRedirect(sessionResult, pathname)
  const settingsRoute = parseSettingsRoute(
    args.params.section,
    args.params.subview
  )
  if (!settingsRoute) {
    throw redirect("/settings")
  }

  const user = sessionResult.user!
  const officialPlugins = await loadOfficialPlugins(env, request.url)
  return responseWithSession(
    {
      user: {
        id: user.sub,
        username: user.username,
        sid: user.sid,
      },
      officialPlugins,
      requestOrigin: new URL(request.url).origin,
      ...settingsRoute,
    },
    sessionResult,
    request
  )
}

const settingsTabs = [
  {
    value: "general",
    label: "General",
    icon: Settings01Icon,
  },
  {
    value: "security",
    label: "Security and login",
    icon: Key01Icon,
  },
  {
    value: "plugins",
    label: "Plugins",
    icon: Plug02Icon,
  },
  {
    value: "usage",
    label: "Usage",
    icon: Activity03Icon,
  },
  {
    value: "storage",
    label: "Storage",
    icon: HardDriveIcon,
  },
  {
    value: "player",
    label: "Player",
    icon: PlayIcon,
  },
] as const

export default function Settings() {
  const {
    user,
    officialPlugins,
    requestOrigin,
    activeTab,
    showActiveSessions,
  } = useLoaderData<typeof loader>()
  const location = useLocation()
  const navigate = useNavigate()

  React.useEffect(() => {
    const legacyPath = getLegacySettingsPath(location.hash)
    if (legacyPath) {
      navigate(legacyPath, { replace: true })
    }
  }, [location.hash, navigate])

  const handleTabChange = (tab: string) => {
    navigate(getSettingsPath(tab as SettingsTab))
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 text-center md:mb-10">
        <h1 className="py-4 text-4xl font-normal tracking-tight text-balance md:py-6 md:text-6xl">
          Settings
        </h1>
      </div>

      <Tabs
        value={activeTab}
        className="bg-background md:!flex-row md:gap-0"
        onValueChange={handleTabChange}
      >
        <aside className="hidden w-64 shrink-0 border-r pr-4 md:flex md:flex-col">
          <TabsList className="!h-auto w-full !flex-col items-stretch justify-start gap-1 bg-transparent">
            {settingsTabs.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="!h-11 !flex-none justify-start rounded-2xl !px-4 gap-2.5 text-base !font-normal text-foreground hover:text-foreground dark:text-foreground dark:hover:text-foreground transition-none data-active:bg-muted dark:data-active:bg-muted data-active:border-transparent dark:data-active:border-transparent after:hidden"
              >
                <HugeiconsIcon
                  icon={item.icon}
                  data-icon="inline-start"
                  className="size-6"
                />
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>

        <div className="border-b py-4 md:hidden">
          <div className="overflow-x-auto pb-1">
            <TabsList className="!h-auto w-full justify-start gap-1.5 bg-transparent min-w-max p-0">
              {settingsTabs.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="!h-10 !flex-none rounded-xl !px-4 gap-2 text-sm !font-normal text-foreground hover:text-foreground dark:text-foreground dark:hover:text-foreground transition-none data-active:bg-muted dark:data-active:bg-muted data-active:border-transparent dark:data-active:border-transparent after:hidden"
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    data-icon="inline-start"
                    className="size-5"
                  />
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="min-w-0 flex-1 py-2 sm:px-4 md:px-8 md:py-0">
          <TabsContent value="general" className="flex flex-col">
            <header className="pb-4">
              <h1 className="text-2xl font-normal tracking-tight">General</h1>
            </header>
            <GeneralSettings />
          </TabsContent>

          <TabsContent value="security" className="flex flex-col">
            <header className="pb-4">
              <h1 className="text-2xl font-normal tracking-tight">
                Security and login
              </h1>
            </header>
            <SecuritySettings
              user={user}
              showActiveSessions={showActiveSessions}
              onShowActiveSessionsChange={(show) =>
                navigate(
                  getSettingsPath(
                    "security",
                    show ? "active-sessions" : undefined
                  ),
                  show ? undefined : { replace: true }
                )
              }
            />
          </TabsContent>

          <TabsContent value="plugins" className="flex flex-col">
            <header className="pb-4">
              <h1 className="text-2xl font-normal tracking-tight">Plugins</h1>
            </header>
            <PluginsSettings
              officialPlugins={officialPlugins}
              requestOrigin={requestOrigin}
            />
          </TabsContent>

          <TabsContent value="storage" className="flex flex-col">
            <header className="pb-4">
              <h1 className="text-2xl font-normal tracking-tight">Storage</h1>
            </header>
            <StorageSettings />
          </TabsContent>

          <TabsContent value="usage" className="flex flex-col">
            <header className="pb-4">
              <h1 className="text-2xl font-normal tracking-tight">Usage</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Track extraction usage within service limits.
              </p>
            </header>
            <UsageSettings officialPlugins={officialPlugins ?? []} />
          </TabsContent>

          <TabsContent value="player" className="flex flex-col">
            <header className="pb-4">
              <h1 className="text-2xl font-normal tracking-tight">Player</h1>
            </header>
            <PlayerSettings />
          </TabsContent>
        </div>
      </Tabs>
    </main>
  )
}
