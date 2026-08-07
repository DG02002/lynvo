import { describe, expect, it } from "vitest"
import {
  formatPlayableExpiry,
  formatPlayableValidity,
} from "~/features/links/format-playable-expiry"

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const NOW = 1_000_000

describe("formatPlayableExpiry", () => {
  it("uses relative time for links expiring within a week", () => {
    expect(formatPlayableExpiry(NOW + DAY_MS, NOW)).toBe(
      "Playable link expires in 1 day"
    )
    expect(formatPlayableExpiry(NOW + 24 * HOUR_MS, NOW)).toBe(
      "Playable link expires in 1 day"
    )
    expect(formatPlayableExpiry(NOW + 45 * MINUTE_MS, NOW)).toBe(
      "Playable link expires in 45 mins"
    )
  })

  it("uses a calendar date for long-lived links", () => {
    expect(formatPlayableExpiry(Date.parse("2030-01-01T00:00:00Z"), NOW)).toBe(
      "Playable link expires Jan 1, 2030"
    )
  })

  it("reports expired links explicitly", () => {
    expect(formatPlayableExpiry(NOW, NOW)).toBe("Playable link expired")
  })
})

describe("formatPlayableValidity", () => {
  it("uses compact units and marks estimated validity", () => {
    expect(
      formatPlayableValidity(NOW + 5 * DAY_MS + 23 * HOUR_MS, NOW, true)
    ).toBe("Link valid for ~5d 23h")
  })
})
