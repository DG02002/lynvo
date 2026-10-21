import * as React from "react"

import { cn } from "~/lib/utils"

interface BrandMarkProps {
  readonly className?: string
}

const useUniqueSvgId = (prefix: string): string =>
  `${prefix}-${React.useId().replaceAll(":", "")}`

// Official Scrape.do mark from https://scrape.do/favicon.svg. Its yellow
// glyph with the translucent white overlay reads on both light and dark
// backgrounds, so it needs no backing tile.
export const ScrapeDoMark = ({ className }: BrandMarkProps) => (
  // oxlint-disable shadcn/no-raw-colors -- Official Scrape.do mark colors, per https://scrape.do
  <svg
    viewBox="0 0 65 64"
    fill="none"
    role="img"
    aria-label="Scrape.do"
    className={className}
  >
    <path
      opacity="0.23"
      d="M32.8603 32.9431L3.6875 16.966L32.8603 2.70508V32.9431Z"
      fill="white"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M29.8107 6.10936L8.01241 16.6698L29.8107 28.5841V6.10936ZM29.8107 34.3213L5.03449 20.7794V29.9981L29.8107 42.7706V34.3213ZM29.8107 48.4346L1.75344 33.9706C0.676619 33.4157 0 32.3055 0 31.0941V14.9574L30.1977 0.327842C32.347 -0.713417 34.8453 0.852174 34.8453 3.2404V14.9972L62.3227 29.0922C63.4027 29.6463 64.0821 30.7581 64.0821 31.9718V46.4616C64.0821 47.674 63.4041 48.7848 62.3259 49.3396L34.5275 63.6374C32.3737 64.745 29.8107 63.1814 29.8107 60.7592V48.4346ZM34.8453 20.6553V57.8127L59.0475 45.3645V33.0703L34.8453 20.6553Z"
      fill="#F9D94A"
    />
  </svg>
  // oxlint-enable shadcn/no-raw-colors
)

// Official Telegram logo, shared by the Help Center and report actions.
export const TelegramMark = ({ className }: BrandMarkProps) => {
  const gradientId = useUniqueSvgId("telegram-brand-gradient")
  return (
    // oxlint-disable shadcn/no-raw-colors -- Official Telegram brand colors, per https://telegram.org
    <svg viewBox="0 0 256 256" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#2AABEE" />
          <stop offset="100%" stopColor="#229ED9" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M128 0C94.06 0 61.48 13.494 37.5 37.49A128.038 128.038 0 0 0 0 128c0 33.934 13.5 66.514 37.5 90.51C61.48 242.506 94.06 256 128 256s66.52-13.494 90.5-37.49c24-23.996 37.5-56.576 37.5-90.51 0-33.934-13.5-66.514-37.5-90.51C194.52 13.494 161.94 0 128 0Z"
      />
      <path
        fill="#FFF"
        d="M57.94 126.648c37.32-16.256 62.2-26.974 74.64-32.152 35.56-14.786 42.94-17.354 47.76-17.441 1.06-.017 3.42.245 4.96 1.49 1.28 1.05 1.64 2.47 1.82 3.467.16.996.38 3.266.2 5.038-1.92 20.24-10.26 69.356-14.5 92.026-1.78 9.592-5.32 12.808-8.74 13.122-7.44.684-13.08-4.912-20.28-9.63-11.26-7.386-17.62-11.982-28.56-19.188-12.64-8.328-4.44-12.906 2.76-20.386 1.88-1.958 34.64-31.748 35.26-34.45.08-.338.16-1.598-.6-2.262-.74-.666-1.84-.438-2.64-.258-1.14.256-19.12 12.152-54 35.686-5.1 3.508-9.72 5.218-13.88 5.128-4.56-.098-13.36-2.584-19.9-4.708-8-2.606-14.38-3.984-13.82-8.41.28-2.304 3.46-4.662 9.52-7.072Z"
      />
    </svg>
    // oxlint-enable shadcn/no-raw-colors
  )
}

// Official GitHub mark, shared by the Help Center and report actions.
export const GitHubMark = ({ className }: BrandMarkProps) => (
  <svg
    viewBox="0 0 1024 1024"
    aria-hidden="true"
    className={cn("fill-current", className)}
  >
    <path
      fillRule="evenodd"
      d="M512 0C229.12 0 0 229.12 0 512c0 226.56 146.56 417.92 350.08 485.76 25.6 4.48 35.2-10.88 35.2-24.32 0-12.16-.64-52.48-.64-95.36-128.64 23.68-161.92-31.36-172.16-60.16-5.76-14.72-30.72-60.16-52.48-72.32-17.92-9.6-43.52-33.28-.64-33.92 40.32-.64 69.12 37.12 78.72 52.48 46.08 77.44 119.68 55.68 149.12 42.24 4.48-33.28 17.92-55.68 32.64-68.48-113.92-12.8-232.96-56.96-232.96-252.8 0-55.68 19.84-101.76 52.48-137.6-5.12-12.8-23.04-65.28 5.12-135.68 0 0 42.88-13.44 140.8 52.48 40.96-11.52 84.48-17.28 128-17.28s87.04 5.76 128 17.28c97.92-66.56 140.8-52.48 140.8-52.48 28.16 70.4 10.24 122.88 5.12 135.68 32.64 35.84 52.48 81.28 52.48 137.6 0 196.48-119.68 240-233.6 252.8 18.56 16 34.56 46.72 34.56 94.72 0 68.48-.64 123.52-.64 140.8 0 13.44 9.6 29.44 35.2 24.32C877.44 929.92 1024 737.92 1024 512 1024 229.12 794.88 0 512 0"
    />
  </svg>
)
