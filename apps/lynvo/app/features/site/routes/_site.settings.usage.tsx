import { UsageSettings } from "~/features/site/settings/usage-settings"

export default function UsageSettingsRoute() {
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track extraction usage within service limits.
        </p>
      </header>
      <UsageSettings lynvoPlugins={[]} />
    </section>
  )
}
