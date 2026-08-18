import { GeneralSettings } from "~/features/site/settings/general-settings"

export default function GeneralSettingsRoute() {
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">General</h1>
      </header>
      <GeneralSettings />
    </section>
  )
}
