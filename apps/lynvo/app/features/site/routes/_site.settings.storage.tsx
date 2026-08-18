import { StorageSettings } from "~/features/site/settings/storage-settings"

export default function StorageSettingsRoute() {
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Storage</h1>
      </header>
      <StorageSettings />
    </section>
  )
}
