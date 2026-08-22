import { useOutletContext } from "react-router"
import { AccountSettings } from "~/features/site/settings/account-settings"
import type { SettingsOutletContext } from "./_site.settings"

export default function AccountSettingsRoute() {
  const { user } = useOutletContext<SettingsOutletContext>()

  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Account</h1>
      </header>
      <AccountSettings user={user} />
    </section>
  )
}
