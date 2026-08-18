import { useLoaderData, type LoaderFunctionArgs } from "react-router"
import { useLogger as getRequestLogger } from "evlog/react-router"
import { PluginsSettings } from "~/features/site/settings/plugins-settings"
import { loadLynvoPlugins } from "~/features/site/settings/lynvo-plugin-catalog.server"
import { getServerEnv } from "~/lib/env.server"

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const startedAt = performance.now()
  const lynvoPlugins = await loadLynvoPlugins(
    getServerEnv(context),
    request.url
  )
  getRequestLogger().set({
    navigation: {
      destination_data: "settings_plugins",
      plugin_manifest_ms: Math.max(0, performance.now() - startedAt),
    },
  })
  return { lynvoPlugins, requestOrigin: new URL(request.url).origin }
}

export default function PluginsSettingsRoute() {
  const { lynvoPlugins, requestOrigin } = useLoaderData<typeof loader>()
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Plugins</h1>
      </header>
      <PluginsSettings
        lynvoPlugins={lynvoPlugins}
        requestOrigin={requestOrigin}
      />
    </section>
  )
}
