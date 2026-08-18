import { PlayerSettings } from "~/features/site/settings/player-settings"

export default function PlayerSettingsRoute() {
  return (
    <section className="flex flex-col">
      <header className="pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Player</h1>
      </header>
      <PlayerSettings />
    </section>
  )
}
