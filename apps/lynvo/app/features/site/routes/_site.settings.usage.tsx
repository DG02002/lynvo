import { useLoaderData, type LoaderFunctionArgs } from "react-router"

import { loadLynvoPlugins } from "~/features/site/settings/lynvo-plugin-catalog.server"
import { useSettingsUser } from "~/features/site/settings/settings-route"
import { UsageSettings } from "~/features/site/settings/usage-settings"
import { getServerEnv } from "~/lib/env.server"

export const loader = async ({ request, context }: LoaderFunctionArgs) => ({
  lynvoPlugins: await loadLynvoPlugins(getServerEnv(context), request.url),
})

export default function UsageSettingsRoute() {
  const { lynvoPlugins } = useLoaderData<typeof loader>()
  const user = useSettingsUser()
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track extraction usage within service limits.
        </p>
      </header>
      <UsageSettings lynvoPlugins={lynvoPlugins} userId={user.id} />
    </section>
  )
}
