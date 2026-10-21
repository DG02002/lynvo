import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { GitHubMark, TelegramMark } from "~/components/brand-marks"
import { GITHUB_ISSUES_URL, TELEGRAM_SUPPORT_URL } from "~/lib/support-links"

import type { Route } from "./+types/_site.help-center"

const supportOptions = [
  {
    title: "Telegram",
    description:
      "Send Lynvo Support a private message for account help or general questions. Only the support team can view the conversation.",
    action: "Message on Telegram",
    href: TELEGRAM_SUPPORT_URL,
    logo: TelegramMark,
    logoClassName: "size-12",
  },
  {
    title: "GitHub Issues",
    description:
      "Report a bug or request a feature in a public post. Anyone can find and read the post, so don’t include personal or account information.",
    action: "Open a GitHub issue",
    href: GITHUB_ISSUES_URL,
    logo: GitHubMark,
    logoClassName: "size-12 fill-github-mark dark:fill-white",
  },
] as const

export const meta = (_: Route.MetaArgs) => [
  { title: "Help center | Lynvo" },
  {
    name: "description",
    content:
      "Contact Lynvo privately on Telegram or report bugs and request features through GitHub Issues.",
  },
]

const HelpCenter = () => (
  <div className="w-full px-6 py-12 md:px-8 lg:px-10 xl:px-14">
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 sm:gap-12">
      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="py-4 text-4xl font-normal text-balance md:py-6 md:text-6xl">
          Help center
        </h1>
      </header>

      <section
        aria-label="Contact options"
        className="divide-y divide-foreground/15 border-y border-foreground/15"
      >
        {supportOptions.map((option) => (
          <article
            key={option.title}
            className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-8 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-x-8 sm:gap-y-2"
          >
            <div className="row-start-1 flex items-center sm:row-span-2 sm:self-center">
              <option.logo className={option.logoClassName} />
            </div>
            <h2 className="col-start-2 row-start-1 self-center text-xl font-normal">
              {option.title}
            </h2>
            <p className="col-span-2 row-start-2 max-w-md text-sm leading-6 text-muted-foreground text-pretty sm:col-span-1 sm:col-start-2">
              {option.description}
            </p>
            <a
              href={option.href}
              target="_blank"
              rel="noreferrer"
              className="col-span-2 row-start-3 mt-1 inline-flex min-h-11 items-center gap-2 justify-self-start text-sm underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:self-center sm:justify-self-end"
            >
              {option.action}
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                strokeWidth={2}
                className="size-4"
              />
            </a>
          </article>
        ))}
      </section>
    </div>
  </div>
)

export default HelpCenter
