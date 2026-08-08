import type { Route } from "./+types/_site._index"
import { HomeHero } from "~/features/site/home/home-hero"
import {
  AndroidScreensSection,
  ExtractionSection,
  PlayerSection,
  PlayerSectionEdgeToEdge,
  PlanSection,
} from "~/features/site/home/home-sections"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Lynvo - Save links. Open them in Android players." },
    {
      name: "description",
      content:
        "Use Lynvo in any browser to save video links, sync your library, and open them in Just (Video) Player, VLC for Android, MPV, or MX Player on Android TV, Android phones, and Android tablets.",
    },
  ]
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip tabular-nums">
      <HomeHero />
      <PlayerSection />
      <PlayerSectionEdgeToEdge />
      <PlanSection />
      <ExtractionSection />
      <AndroidScreensSection />
    </div>
  )
}
