import { HugeiconsIcon } from "@hugeicons/react"
import { SmartPhone01Icon, Tv01Icon } from "@hugeicons/core-free-icons"
import { cn } from "~/lib/utils"
import { PlayerCardSwap } from "./player-card-swap"
import { PlayerEdgeCarousel } from "./player-edge-carousel"

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
  <section className="hidden overflow-hidden bg-background py-24 md:py-32 lg:block">
    <div className="player-showcase">
      <div className="player-showcase__copy">
        <h2 className="text-balance text-4xl font-normal tracking-[-0.04em] text-foreground md:text-5xl lg:text-6xl">
          Open links in one of four Android players.
        </h2>
        <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Lynvo sends each link to the external Android player you choose. Use
          Just (Video) Player, VLC for Android, MPV, or MX Player.
        </p>
      </div>

      <div className="player-showcase__visual">
        <PlayerCardSwap />
      </div>
    </div>
  </section>
)

export const PlayerSectionEdgeToEdge = () => (
  <section className="overflow-hidden bg-background py-24 md:py-32 lg:hidden">
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center md:px-8">
      <h2 className="text-balance text-4xl font-normal tracking-[-0.04em] text-foreground md:text-5xl lg:text-6xl">
        Open links in one of four Android players.
      </h2>
      <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
        Lynvo sends each link to the external Android player you choose. Use
        Just (Video) Player, VLC for Android, MPV, or MX Player.
      </p>
    </div>

    <div className="mt-16 md:mt-24">
      <PlayerEdgeCarousel />
    </div>
  </section>
)

export const ExtractionSection = () => (
  <section className="relative overflow-hidden bg-background py-24 md:py-32">
    <div className="grid w-full gap-16 px-6 md:px-8 lg:grid-cols-2 lg:items-center lg:px-10 xl:px-14">
      <SectionIntro
        title="Open links from Sources."
        description="Use Plugins managed by Lynvo, or connect a compatible Custom Plugin Server for additional Sources."
      />

      <div className="flex flex-col gap-8">
        <div>
          <p className="text-lg">Lynvo Plugin Server</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Open links from Sources handled by Lynvo-managed Plugins. Current
            availability appears in Settings.
          </p>
        </div>
        <div>
          <p className="text-lg">Custom Plugin Servers</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Connect a compatible Custom Plugin Server to add its Plugins and the
            Sources they handle.
          </p>
        </div>
      </div>
    </div>
  </section>
)

export const AndroidScreensSection = () => (
  <section className="relative overflow-hidden bg-background py-24 md:py-32">
    <div className="grid w-full gap-16 px-6 md:px-8 lg:grid-cols-2 lg:items-center lg:px-10 xl:px-14">
      <SectionIntro
        title="Use Lynvo across Android devices."
        description="Open links on Android TV, Android phones, and Android tablets from a library that stays in sync."
      />

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-6 rounded-[16px] bg-background p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_16px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-[8px] bg-foreground text-background">
            <HugeiconsIcon icon={Tv01Icon} className="size-7" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg text-foreground">Android TV</span>
            <span className="text-sm text-muted-foreground">
              Navigate with the TV Bro browser
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 rounded-[16px] bg-background p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_16px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)] sm:ml-12">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-[8px] bg-foreground text-background">
            <HugeiconsIcon icon={SmartPhone01Icon} className="size-7" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg text-foreground">
              Android phones and tablets
            </span>
            <span className="text-sm text-muted-foreground">
              Save and open links with touch controls
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
)

export const PlanSection = () => {
  return (
    <section className="relative overflow-hidden bg-background py-32 md:py-48">
      <div className="relative z-10 flex w-full flex-col items-center gap-16 px-6 text-center md:px-8 lg:px-10 xl:px-14">
        <h2 className="text-balance text-4xl font-normal tracking-[-0.04em] text-foreground md:text-6xl lg:text-8xl">
          The Free plan is available now.
        </h2>

        <div className="grid w-full grid-cols-1 gap-12 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-3">
            <span className="text-2xl text-foreground">3 MB of storage</span>
            <span className="text-sm text-muted-foreground text-center">
              Save up to 100 links, subject to the storage limit.
            </span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <span className="text-2xl text-foreground">Real-time sync</span>
            <span className="text-sm text-muted-foreground text-center">
              A link saved in one browser or device appears in the library on
              connected browsers and devices.
            </span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <span className="text-2xl text-foreground">
              Android TV, phones, and tablets
            </span>
            <span className="text-sm text-muted-foreground text-center">
              Open links in supported external Android players.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
