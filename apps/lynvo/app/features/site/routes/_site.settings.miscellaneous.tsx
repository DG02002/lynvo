import { MiscellaneousSettings } from "~/features/site/settings/miscellaneous-settings"

const MiscellaneousSettingsRoute = () => (
  <section className="flex flex-col">
    <header className="pb-4">
      <h1 className="text-2xl font-normal tracking-tight">Miscellaneous</h1>
    </header>
    <MiscellaneousSettings />
  </section>
)

export default MiscellaneousSettingsRoute
