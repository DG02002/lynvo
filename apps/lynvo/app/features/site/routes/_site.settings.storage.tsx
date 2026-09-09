import { useOutletContext } from "react-router"
import { StorageSettings } from "~/features/site/settings/storage-settings"
import type { SettingsOutletContext } from "./_site.settings"

export default function StorageSettingsRoute() {
  const { user } = useOutletContext<SettingsOutletContext>()
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Storage</h1>
      </header>
      <StorageSettings userId={user.id} />
    </section>
  )
}
