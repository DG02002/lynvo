import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  SmartPhone01Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { Link } from "react-router"
import { buttonVariants } from "~/components/ui/button"
import { PLAYER_DEFINITIONS } from "~/lib/player-utils"
import { authPaths, sitePaths } from "~/lib/paths"
import { cn } from "~/lib/utils"
import { privacyPoints } from "./home-content"

const SectionIntro = ({
  title,
  description,
  centered = false,
}: {
  title: string
  description: string
  centered?: boolean
}) => (
  <div
    className={cn(
      "flex flex-col gap-4 max-w-2xl",
      centered && "items-center text-center mx-auto"
    )}
  >
    <h2 className="text-balance text-4xl font-normal tracking-[-0.04em] md:text-5xl lg:text-6xl">
      {title}
    </h2>
    <p className="text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
      {description}
    </p>
  </div>
)

export const FeaturesSection = () => {
  return (
    <div className="flex flex-col">
      {/* Extraction Section */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="mx-auto grid max-w-5xl gap-16 px-6 lg:grid-cols-2 lg:items-center">
          <SectionIntro
            title="Extract supported links."
            description="Use Lynvo's official plugins for supported sources, or connect your own compatible external extractor for other links."
          />

          <div className="flex flex-col gap-8">
            <div>
              <p className="text-lg">Official extractor</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Use managed sources whose current capabilities are shown in
                Settings from the official extractor manifest.
              </p>
            </div>
            <div>
              <p className="text-lg">External extractors</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Connect a Lynvo-compatible extractor worker for sources outside
                the official plugin list.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Players Section */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-16 px-6">
          <SectionIntro
            title="Open links in a preferred player."
            description="Set different defaults for resume vs non-resume links. Lynvo automatically opens the right app on your Android device."
            centered
          />

          <div className="grid w-full max-w-5xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 md:grid-cols-5">
            {PLAYER_DEFINITIONS.map((player) => (
              <div
                key={player.id}
                className="flex flex-col items-center justify-center gap-4 px-1 py-4"
              >
                <img
                  src={player.iconUrl}
                  alt=""
                  className="size-12 rounded-[8px] object-cover"
                />
                <span className="whitespace-nowrap text-sm leading-tight text-foreground">
                  {player.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Any Device Section */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="mx-auto grid max-w-5xl gap-16 px-6 lg:grid-cols-2 lg:items-center">
          <SectionIntro
            title="Use every Android screen."
            description="Access your links on Android TV, Android phones, and Android tablets. The interface adapts to each screen and stays in sync."
          />

          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-6 rounded-[16px] bg-background p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_16px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-[8px] bg-foreground text-background">
                <HugeiconsIcon icon={Tv01Icon} className="size-7" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg text-foreground">Android TV</span>
                <span className="text-sm text-muted-foreground">
                  Lean-back remote optimized
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 rounded-[16px] bg-background p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_16px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)] sm:ml-12">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-[8px] bg-foreground text-background">
                <HugeiconsIcon icon={SmartPhone01Icon} className="size-7" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg text-foreground">Phone & Tablet</span>
                <span className="text-sm text-muted-foreground">
                  Touch-first progressive web app
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export const PlanSection = () => {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="mx-auto grid max-w-5xl gap-16 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-24">
        <div className="flex max-w-2xl flex-col items-start gap-6">
          <span className="text-sm text-muted-foreground">Plans</span>
          <h2 className="text-balance text-4xl font-normal tracking-[-0.04em] md:text-5xl lg:text-6xl">
            Start free. See exactly what’s included.
          </h2>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Lynvo currently has one Free plan for saving, extracting, syncing,
            and playing supported links. Review every allowance before you
            start.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={authPaths.createAccount}
              viewTransition
              className={buttonVariants({ size: "lg" })}
            >
              Get Free
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                strokeWidth={2}
                data-icon="inline-end"
              />
            </Link>
            <Link
              to={sitePaths.pricing}
              viewTransition
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              View plan details
            </Link>
          </div>
        </div>

        <div className="flex flex-col border-y border-border">
          <div className="flex items-end justify-between gap-6 py-6">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">
                Available now
              </span>
              <span className="text-2xl text-foreground">Free</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl tracking-tight text-foreground">
                ₹0
              </span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-t border-border py-6">
            <div className="flex flex-col gap-1">
              <span className="text-lg text-foreground">3 MB</span>
              <span className="text-sm text-muted-foreground">
                Account storage
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-lg text-foreground">100</span>
              <span className="text-sm text-muted-foreground">Saved links</span>
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-lg text-foreground">Included</span>
              <span className="text-sm leading-relaxed text-muted-foreground">
                Real-time sync, Android playback, remote control, official
                sources, and external extractors.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export const PrivacySection = () => (
  <section className="py-24 md:py-32">
    <div className="mx-auto grid max-w-5xl gap-16 px-6 lg:grid-cols-2 lg:gap-24">
      <div className="flex flex-col gap-6">
        <h2 className="text-balance text-4xl font-normal tracking-[-0.04em] md:text-5xl lg:text-6xl">
          No Lynvo app on your device.
        </h2>
        <p className="text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Lynvo runs in your browser, so there is no Lynvo app taking up space
          or running on your Android device. When you press play, Lynvo sends
          the playable link directly to a supported video player you already
          installed, such as Just Player or VLC.
        </p>
      </div>
      <div className="flex flex-col divide-y divide-border border-y border-border">
        {privacyPoints.map((point) => (
          <div key={point} className="flex items-center gap-4 py-6">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="size-6 shrink-0 text-muted-foreground"
            />
            <span className="text-lg">{point}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
)

export const AndroidTvSetupSection = () => (
  <section className="py-24 md:py-32">
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-10 px-6 text-center">
      <SectionIntro
        title="Open Lynvo on Android TV."
        description="Open Lynvo in TV Bro, a web browser designed for televisions and remote controls."
        centered
      />
      <a
        href="https://play.google.com/store/apps/details?id=com.phlox.tvwebbrowser"
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-4"
      >
        Install TV Bro from Google Play
      </a>
    </div>
  </section>
)
