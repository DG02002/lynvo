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

      <div className="relative mx-auto w-full max-w-3xl pb-12 sm:pb-20">
        <div className="relative rounded-[10px] bg-gradient-to-b from-neutral-600 via-neutral-900 to-neutral-950 p-[5px] shadow-[0_30px_60px_-28px_rgba(0,0,0,0.7)]">
          <div className="overflow-hidden rounded-[6px] bg-black">
            <img
              src="/images/device-previews/lynvo-tv-screen.webp"
              alt="Lynvo library displayed on a television"
              className="aspect-video h-auto w-full object-cover object-top"
              width="1600"
              height="1067"
              loading="lazy"
            />
          </div>
          <div className="absolute bottom-1 left-1/2 h-px w-10 -translate-x-1/2 rounded-full bg-white/25" />
          <div className="absolute -bottom-5 left-1/2 h-5 w-14 -translate-x-1/2 bg-gradient-to-b from-neutral-700 to-neutral-950 [clip-path:polygon(35%_0,65%_0,100%_100%,0_100%)] sm:-bottom-7 sm:h-7 sm:w-20" />
          <div className="absolute -bottom-6 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full bg-neutral-900 shadow-lg sm:-bottom-9 sm:w-40" />
        </div>

        <div className="absolute -bottom-2 right-[5%] w-[24%] min-w-24 max-w-44 rounded-[14px] bg-neutral-800 p-[3px] shadow-[0_24px_40px_-14px_rgba(0,0,0,0.75)] sm:rounded-[18px] sm:p-1">
          <div className="relative overflow-hidden rounded-[11px] bg-black sm:rounded-[14px]">
            <img
              src="/images/device-previews/lynvo-phone-screen.webp"
              alt="Lynvo library displayed on an Android phone"
              className="h-auto w-full"
              width="884"
              height="1921"
              loading="lazy"
            />
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
            <span className="text-2xl text-foreground">1 MB of storage</span>
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
