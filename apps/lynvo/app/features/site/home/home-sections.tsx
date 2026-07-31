import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  SmartPhone01Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { Link } from "react-router"
import { sitePaths } from "~/lib/paths"
import { cn } from "~/lib/utils"
import { privacyPoints } from "./home-content"
import { PlayerCardSwap } from "./player-card-swap"

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

export const PlayerSection = () => (
  <section className="overflow-hidden py-24 md:py-32">
    <div className="player-showcase">
      <div className="player-showcase__copy">
        <h2 className="text-balance text-4xl font-normal tracking-[-0.04em] text-foreground md:text-5xl lg:text-6xl">
          Open links in a preferred player.
        </h2>
        <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Set different defaults for resume vs non-resume links. Lynvo
          automatically opens the right app on your Android device.
        </p>
      </div>

      <div className="player-showcase__visual">
        <PlayerCardSwap />
      </div>
    </div>
  </section>
)

export const ExtractionSection = () => (
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
            Use managed sources whose current capabilities are shown in Settings
            from the official extractor manifest.
          </p>
        </div>
        <div>
          <p className="text-lg">External extractors</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Connect a Lynvo-compatible extractor worker for sources outside the
            official plugin list.
          </p>
        </div>
      </div>
    </div>
  </section>
)

export const AndroidScreensSection = () => (
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
)

export const PlanSection = () => {
  return (
    <section className="relative overflow-hidden py-32 md:py-48">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30 dark:opacity-20">
        <div className="h-[30rem] w-[30rem] rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-16 px-6 text-center">
        <h2 className="text-balance text-6xl font-normal tracking-[-0.04em] text-foreground md:text-8xl">
          Free Limited Time.
        </h2>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-12 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-3">
            <span className="text-2xl text-foreground">3MB Storage</span>
            <span className="text-sm text-muted-foreground text-center">
              More than enough capacity for thousands of video links.
            </span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <span className="text-2xl text-foreground">Real-time sync</span>
            <span className="text-sm text-muted-foreground text-center">
              Add a link on your phone, see it on your TV instantly.
            </span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <span className="text-2xl text-foreground">
              Across Android devices
            </span>
            <span className="text-sm text-muted-foreground text-center">
              Works flawlessly on Android TV, phones, and tablets.
            </span>
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
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <Link
          to={sitePaths.androidTvSetup}
          viewTransition
          className="text-primary underline underline-offset-4"
        >
          Set up Lynvo on Android TV
        </Link>
        <a
          href="https://play.google.com/store/apps/details?id=com.phlox.tvwebbrowser"
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Install TV Bro
        </a>
      </div>
    </div>
  </section>
)
