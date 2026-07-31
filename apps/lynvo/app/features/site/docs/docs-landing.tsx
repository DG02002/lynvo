import {
  ArrowRight01Icon,
  ModernTvIcon,
  ThreeDViewIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router"

const documentationCards = [
  {
    title: "Android TV Setup",
    description: "Set up Lynvo on Android TV with your phone.",
    to: "/docs/android-tv",
    icon: ModernTvIcon,
  },
  {
    title: "Extractor",
    description: "Build extractors that support your media sources.",
    to: "/docs/extractor",
    icon: ThreeDViewIcon,
  },
] as const

export const DocsLanding = () => (
  <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8 md:py-20">
    <div className="flex flex-col gap-12">
      <header className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <p className="text-sm">Documentation</p>
        <h1 className="py-4 text-4xl font-normal tracking-tight text-balance md:py-6 md:text-6xl">
          Lynvo for developers
        </h1>
        <p className="max-w-xl text-base leading-7 text-foreground text-pretty">
          Docs and resources to help you use, configure, and build with Lynvo.
        </p>
      </header>

      <section
        aria-label="Documentation guides"
        className="mx-auto grid w-full max-w-3xl gap-4 md:grid-cols-2"
      >
        {documentationCards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            viewTransition
            className="flex min-h-64 flex-col justify-between rounded-2xl bg-muted/35 p-6 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07),0_8px_24px_-16px_rgba(0,0,0,0.2)] transition-[background-color,box-shadow,scale] duration-200 hover:bg-muted/60 hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1),0_18px_40px_-20px_rgba(0,0,0,0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:scale-[0.96] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
          >
            <span className="flex size-12 items-center justify-center">
              <HugeiconsIcon
                icon={card.icon}
                className="size-8"
                strokeWidth={1.5}
              />
            </span>
            <span className="flex items-end justify-between gap-6">
              <span className="flex max-w-sm flex-col gap-2">
                <span className="text-2xl tracking-tight text-balance">
                  {card.title}
                </span>
                <span className="text-sm leading-6 text-muted-foreground text-pretty">
                  {card.description}
                </span>
              </span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                aria-hidden="true"
                className="mb-1 size-5 shrink-0"
              />
            </span>
          </Link>
        ))}
      </section>
    </div>
  </div>
)
