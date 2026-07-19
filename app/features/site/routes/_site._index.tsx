import { useRouteLoaderData } from "react-router"
import type { Route } from "./+types/_site._index"
import type { loader as rootLoader } from "~/root"
import { HomeHero } from "~/features/site/home/home-hero"
import {
  FeaturesSection,
  PlanSection,
  FaqSection,
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
  const rootData = useRouteLoaderData<typeof rootLoader>("root")

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip tabular-nums">
      <HomeHero isSignedIn={Boolean(rootData?.user)} />
      <FeaturesSection />
      <PlanSection />
      <PrivacySection />
      <AndroidTvSetupSection />
      <FaqSection />
    </div>
  )
}
