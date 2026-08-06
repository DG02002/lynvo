import { describe, expect, it } from "vitest"
import { formatDraftExpiry } from "~/features/links/format-draft-expiry"

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const NOW = 1_000_000

describe("formatDraftExpiry", () => {
  it("formats days and hours for longer-lived drafts", () => {
    expect(formatDraftExpiry(NOW + 2 * DAY_MS + 3 * HOUR_MS, NOW)).toBe(
      "Expiring in 2 days 3 hours"
    )
  })

  it("formats hours and minutes for drafts expiring today", () => {
    expect(formatDraftExpiry(NOW + HOUR_MS + 5 * MINUTE_MS, NOW)).toBe(
      "Expiring in 1 hour 5 mins"
    )
  })

  it("formats an imminent expiration clearly", () => {
    expect(formatDraftExpiry(NOW + 30 * MINUTE_MS, NOW)).toBe(
      "Expiring in 30 mins"
    )
    expect(formatDraftExpiry(NOW, NOW)).toBe("Expiring now")
  })
})
