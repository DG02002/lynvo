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

// Official Telegram plane mark on the Telegram brand gradient, per
// https://telegram.org brand guidelines.
interface TelegramMarkProps extends BrandMarkProps {
  /**
   * Render only the white plane glyph, cropped to its own bounds. On a
   * Telegram-gradient surface the circular badge disappears into the
   * background and the uncropped glyph reads roughly half its box, so the
   * crop keeps the plane at the same visual size as neighboring marks.
   */
  readonly glyphOnly?: boolean
}

export const TelegramMark = ({
  className,
  glyphOnly = false,
}: TelegramMarkProps) => {
  const gradientId = useUniqueSvgId("telegram-brand-gradient")
  return (
    // oxlint-disable shadcn/no-raw-colors -- Official Telegram brand colors, per https://telegram.org
    <svg
      viewBox={glyphOnly ? "48.39 77.05 139 115.2" : "0 0 256 256"}
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#2AABEE" />
          <stop offset="100%" stopColor="#229ED9" />
        </linearGradient>
      </defs>
      {!glyphOnly && (
        <path
          fill={`url(#${gradientId})`}
          d="M128 0C94.06 0 61.48 13.494 37.5 37.49A128.038 128.038 0 0 0 0 128c0 33.934 13.5 66.514 37.5 90.51C61.48 242.506 94.06 256 128 256s66.52-13.494 90.5-37.49c24-23.996 37.5-56.576 37.5-90.51 0-33.934-13.5-66.514-37.5-90.51C194.52 13.494 161.94 0 128 0Z"
        />
      )}
      <path
        fill="#FFF"
        d="M57.94 126.648c37.32-16.256 62.2-26.974 74.64-32.152 35.56-14.786 42.94-17.354 47.76-17.441 1.06-.017 3.42.245 4.96 1.49 1.28 1.05 1.64 2.47 1.82 3.467.16.996.38 3.266.2 5.038-1.92 20.24-10.26 69.356-14.5 92.026-1.78 9.592-5.32 12.808-8.74 13.122-7.44.684-13.08-4.912-20.28-9.63-11.26-7.386-17.62-11.982-28.56-19.188-12.64-8.328-4.44-12.906 2.76-20.386 1.88-1.958 34.64-31.748 35.26-34.45.08-.338.16-1.598-.6-2.262-.74-.666-1.84-.438-2.64-.258-1.14.256-19.12 12.152-54 35.686-5.1 3.508-9.72 5.218-13.88 5.128-4.56-.098-13.36-2.584-19.9-4.708-8-2.606-14.38-3.984-13.82-8.41.28-2.304 3.46-4.662 9.52-7.072Z"
      />
    </svg>
    // oxlint-enable shadcn/no-raw-colors
  )
}

// Official GitHub mark, per https://github.com/logos brand guidelines.
export const GitHubMark = ({ className }: BrandMarkProps) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    className={cn("fill-current", className)}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
    />
  </svg>
)
