import { StorageSettings } from "~/features/site/settings/storage-settings"
import { useSettingsUser } from "~/features/site/settings/settings-route"

export default function StorageSettingsRoute() {
  const user = useSettingsUser()
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Storage</h1>
      </header>
      <StorageSettings userId={user.id} />
    </section>
  )
}
