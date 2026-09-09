import { AccountSettings } from "~/features/site/settings/account-settings"
import { useSettingsUser } from "~/features/site/settings/settings-route"

export default function AccountSettingsRoute() {
  const user = useSettingsUser()

  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Account</h1>
      </header>
      <AccountSettings user={user} />
    </section>
  )
}
