import { ProxySettings } from "~/features/site/settings/proxy-settings"
import { useSettingsRequestOrigin } from "~/features/site/settings/settings-route"

export default function ProxySettingsRoute() {
  const requestOrigin = useSettingsRequestOrigin()

  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Proxy</h1>
      </header>
      <ProxySettings requestOrigin={requestOrigin} />
    </section>
  )
}
