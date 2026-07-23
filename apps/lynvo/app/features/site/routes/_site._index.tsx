import type { Route } from "./+types/_site._index"
import { HomeHero } from "~/features/site/home/home-hero"
import {
  FeaturesSection,
  PlanSection,
  PrivacySection,
  AndroidTvSetupSection,
} from "~/features/site/home/home-sections"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Lynvo - Save the link. Stream on TV." },
    {
      name: "description",
      content:
        "Save video links, sync your library, and open them in your preferred player across Android TV, phones, and tablets.",
    },
  ]
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip tabular-nums">
      <HomeHero />
      <FeaturesSection />
      <PlanSection />
      <PrivacySection />
      <AndroidTvSetupSection />
    </div>
  )
}
