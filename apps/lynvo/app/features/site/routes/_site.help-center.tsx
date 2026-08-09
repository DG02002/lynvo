import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { Route } from "./+types/_site.help-center"
import { GITHUB_ISSUES_URL, TELEGRAM_SUPPORT_URL } from "~/lib/support-links"

const TelegramLogo = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 256 256"
    preserveAspectRatio="xMidYMid"
    className="size-12"
  >
    <defs>
      <linearGradient
        id="telegram-support-gradient"
        x1="50%"
        x2="50%"
        y1="0%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#2AABEE" />
        <stop offset="100%" stopColor="#229ED9" />
      </linearGradient>
    </defs>
    <path
      fill="url(#telegram-support-gradient)"
      d="M128 0C94.06 0 61.48 13.494 37.5 37.49A128.038 128.038 0 0 0 0 128c0 33.934 13.5 66.514 37.5 90.51C61.48 242.506 94.06 256 128 256s66.52-13.494 90.5-37.49c24-23.996 37.5-56.576 37.5-90.51 0-33.934-13.5-66.514-37.5-90.51C194.52 13.494 161.94 0 128 0Z"
    />
    <path
      fill="#FFF"
      d="M57.94 126.648c37.32-16.256 62.2-26.974 74.64-32.152 35.56-14.786 42.94-17.354 47.76-17.441 1.06-.017 3.42.245 4.96 1.49 1.28 1.05 1.64 2.47 1.82 3.467.16.996.38 3.266.2 5.038-1.92 20.24-10.26 69.356-14.5 92.026-1.78 9.592-5.32 12.808-8.74 13.122-7.44.684-13.08-4.912-20.28-9.63-11.26-7.386-17.62-11.982-28.56-19.188-12.64-8.328-4.44-12.906 2.76-20.386 1.88-1.958 34.64-31.748 35.26-34.45.08-.338.16-1.598-.6-2.262-.74-.666-1.84-.438-2.64-.258-1.14.256-19.12 12.152-54 35.686-5.1 3.508-9.72 5.218-13.88 5.128-4.56-.098-13.36-2.584-19.9-4.708-8-2.606-14.38-3.984-13.82-8.41.28-2.304 3.46-4.662 9.52-7.072Z"
    />
  </svg>
)

const GitHubLogo = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 1024 1024"
    fill="none"
    className="size-12 fill-[#1b1f23] dark:fill-white"
  >
    <path
      fillRule="evenodd"
      d="M512 0C229.12 0 0 229.12 0 512c0 226.56 146.56 417.92 350.08 485.76 25.6 4.48 35.2-10.88 35.2-24.32 0-12.16-.64-52.48-.64-95.36-128.64 23.68-161.92-31.36-172.16-60.16-5.76-14.72-30.72-60.16-52.48-72.32-17.92-9.6-43.52-33.28-.64-33.92 40.32-.64 69.12 37.12 78.72 52.48 46.08 77.44 119.68 55.68 149.12 42.24 4.48-33.28 17.92-55.68 32.64-68.48-113.92-12.8-232.96-56.96-232.96-252.8 0-55.68 19.84-101.76 52.48-137.6-5.12-12.8-23.04-65.28 5.12-135.68 0 0 42.88-13.44 140.8 52.48 40.96-11.52 84.48-17.28 128-17.28s87.04 5.76 128 17.28c97.92-66.56 140.8-52.48 140.8-52.48 28.16 70.4 10.24 122.88 5.12 135.68 32.64 35.84 52.48 81.28 52.48 137.6 0 196.48-119.68 240-233.6 252.8 18.56 16 34.56 46.72 34.56 94.72 0 68.48-.64 123.52-.64 140.8 0 13.44 9.6 29.44 35.2 24.32C877.44 929.92 1024 737.92 1024 512 1024 229.12 794.88 0 512 0"
      clipRule="evenodd"
    />
  </svg>
)

const supportOptions = [
  {
    title: "Telegram",
    description:
      "Send Lynvo Support a private message for account help or general questions. Only the support team can view the conversation.",
    action: "Message on Telegram",
    href: TELEGRAM_SUPPORT_URL,
    logo: TelegramLogo,
  },
  {
    title: "GitHub Issues",
    description:
      "Report a bug or request a feature in a public post. Anyone can find and read the post, so don’t include personal or account information.",
    action: "Open a GitHub issue",
    href: GITHUB_ISSUES_URL,
    logo: GitHubLogo,
  },
] as const

export const meta = (_: Route.MetaArgs) => [
  { title: "Support | Lynvo" },
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
        <h1 className="py-4 text-4xl font-normal tracking-tight text-balance md:py-6 md:text-6xl">
          Get help with Lynvo
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
              <option.logo />
            </div>
            <h2 className="col-start-2 row-start-1 self-center text-xl font-normal tracking-tight">
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
