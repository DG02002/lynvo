import {
  ArrowRight01Icon,
  Key01Icon,
  ModernTvIcon,
  PlayIcon,
  PlugSocketIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router"

import { useViewTransition } from "~/lib/client-profile"

const documentationCardRows = [
  {
    title: "Get started",
    cards: [
      {
        title: "Start guide",
        description:
          "Save a link, choose what to open, and play it on your TV.",
        to: "/docs/start-guide",
        icon: Rocket01Icon,
      },
      {
        title: "Android TV setup",
        description: "Install TV Bro and players, then sign in on your TV.",
        to: "/docs/android-tv",
        icon: ModernTvIcon,
      },
    ],
  },
  {
    title: "Plugins and playback",
    cards: [
      {
        title: "Plugins",
        description:
          "Connect a Custom Plugin Server and configure its Sources.",
        to: "/docs/plugins",
        icon: PlugSocketIcon,
      },
      {
        title: "Proxy keys",
        description: "Use your Scrape.do account with a supported server.",
        to: "/docs/proxy-keys",
        icon: Key01Icon,
      },
      {
        title: "Developers",
        description: "Build a Plugin Server that follows the Lynvo protocol.",
        to: "/docs/plugin-server",
        icon: PlayIcon,
      },
    ],
  },
] as const

export const DocsLanding = () => {
  const viewTransition = useViewTransition()

  return (
    <div className="w-full px-6 py-12 md:px-8 md:py-20 lg:px-10 xl:px-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12">
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Documentation</p>
          <h1 className="text-4xl font-normal tracking-tight text-balance md:text-6xl">
            Lynvo documentation
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
            Save supported links and open them in the player you already use.
          </p>
        </header>

        {documentationCardRows.map((row) => (
          <section key={row.title} className="flex flex-col gap-4">
            <h2 className="text-xl font-normal tracking-tight">{row.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {row.cards.map((card) => (
                <Link
                  key={card.to}
                  to={card.to}
                  prefetch="intent"
                  viewTransition={viewTransition}
                  className="group flex min-h-56 flex-col justify-between gap-8 rounded-2xl bg-muted/35 p-6 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07),0_8px_24px_-16px_rgba(0,0,0,0.2)] transition-[background-color,box-shadow,scale] duration-200 hover:bg-muted/60 hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1),0_18px_40px_-20px_rgba(0,0,0,0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:scale-[0.96] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                >
                  <HugeiconsIcon
                    icon={card.icon}
                    aria-hidden="true"
                    className="size-8"
                    strokeWidth={1.5}
                  />
                  <span className="flex items-end justify-between gap-4">
                    <span className="flex min-w-0 flex-col gap-2">
                      <span className="text-xl tracking-tight text-balance">
                        {card.title}
                      </span>
                      <span className="text-sm leading-6 text-muted-foreground text-pretty">
                        {card.description}
                      </span>
                    </span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      aria-hidden="true"
                      className="mb-1 size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
