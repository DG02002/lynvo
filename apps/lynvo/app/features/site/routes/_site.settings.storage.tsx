import { useSettingsUser } from "~/features/site/settings/settings-route"
import { StorageSettings } from "~/features/site/settings/storage-settings"

export default function StorageSettingsRoute() {
  const user = useSettingsUser()
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal">Storage</h1>
      </header>
      <StorageSettings userId={user.id} />
    </section>
  )
}
