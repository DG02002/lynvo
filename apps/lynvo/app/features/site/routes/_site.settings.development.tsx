import { DevelopmentSettings } from "~/features/site/settings/development-settings"

export default function DevelopmentSettingsRoute() {
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Development</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Testing controls for local development. These settings apply only to
          this browser.
        </p>
      </header>
      <DevelopmentSettings />
    </section>
  )
}
