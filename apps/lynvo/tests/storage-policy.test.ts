import { describe, expect, it } from "vitest"
import {
  assertLinkSize,
  assertStorageGrowth,
  byteLength,
  calculateStorageUsage,
  getRetentionCutoff,
  normalizeRetentionDays,
  projectStorageBytes,
  selectExpiredLinks,
  STORAGE_DOMAIN_NAMES,
} from "../convex/storagePolicy"
import {
  DAY_MS,
  DEFAULT_RETENTION_DAYS,
  LINK_LIMIT_BYTES,
  MAX_REGISTERED_ACCOUNTS,
  STORAGE_RETENTION_DAY_OPTIONS,
  USER_STORAGE_WARNING_BYTES,
  USER_STORAGE_LIMIT_BYTES,
} from "../convex/constants"

describe("storage policy", () => {
  it("uses the launch account and saved-link limits", () => {
    expect(USER_STORAGE_LIMIT_BYTES).toBe(1024 * 1024)
    expect(USER_STORAGE_WARNING_BYTES).toBe(Math.round(0.8 * 1024 * 1024))
    expect(LINK_LIMIT_BYTES).toBe(256 * 1024)
    expect(MAX_REGISTERED_ACCOUNTS).toBe(400)
  })

  it("offers only the supported saved-link retention windows", () => {
    expect(STORAGE_RETENTION_DAY_OPTIONS).toEqual([7, 15, 30])
    expect(DEFAULT_RETENTION_DAYS).toBe(30)
    expect(normalizeRetentionDays(15)).toBe(15)
    expect(() => normalizeRetentionDays(90)).toThrow(
      "Choose an available auto-delete period"
    )
  })

  it("projects empty and combined storage from the canonical inventory", () => {
    expect(calculateStorageUsage({})).toEqual({
      estimatedBytes: 0,
      linkBytes: 0,
      pluginServerBytes: 0,
      pluginDomainBytes: 0,
      authBytes: 0,
      profileBytes: 0,
      savedLinkCount: 0,
      averageLinkBytes: 0,
    })

    const inventory = {
      profile: [{ name: "Ada" }],
      links: [{ url: "https://example.com" }],
      pluginServers: [{ baseUrl: "https://plugin-server.example" }],
      pluginDomains: [{ domain: "example.com" }],
      pluginCredentials: [{ ciphertext: "secret" }],
      authSessions: [{ expirationTime: 10 }],
      authAccounts: [{ provider: "password" }],
      deviceCodes: [{ code: "ABCD" }],
    }
    const expectedBytes = Object.values(inventory)
      .flat()
      .reduce((totalBytes, document) => totalBytes + byteLength(document), 0)
    const usage = calculateStorageUsage(inventory)

    expect(STORAGE_DOMAIN_NAMES).toEqual(Object.keys(inventory))
    expect(usage.estimatedBytes).toBe(expectedBytes)
    expect(usage.pluginDomainBytes).toBe(
      byteLength(inventory.pluginDomains[0]) +
        byteLength(inventory.pluginCredentials[0])
    )
  })

  it("accepts the limit, rejects growth above it, and permits non-growing changes", () => {
    expect(() => assertStorageGrowth(USER_STORAGE_LIMIT_BYTES)).not.toThrow()
    expect(() => assertStorageGrowth(USER_STORAGE_LIMIT_BYTES + 1)).toThrow(
      "Storage is full. Remove saved links before adding another."
    )
    expect(() =>
      assertStorageGrowth(USER_STORAGE_LIMIT_BYTES + 1, -1)
    ).not.toThrow()
    expect(projectStorageBytes(100, 40, 60)).toBe(120)
    expect(projectStorageBytes(100, 60, 40)).toBe(80)
    expect(projectStorageBytes(100, 50, 50)).toBe(100)
  })

  it("preserves the per-link limit", () => {
    expect(() => assertLinkSize(LINK_LIMIT_BYTES)).not.toThrow()
    expect(() => assertLinkSize(LINK_LIMIT_BYTES + 1)).toThrow(
      "This link contains too much data to save."
    )
  })

  it("selects only links older than the retention cutoff", () => {
    const now = 10 * DAY_MS
    const cutoff = getRetentionCutoff(now, 7)
    const links = [
      { createdAt: cutoff - 1, url: "expired" },
      { createdAt: cutoff, url: "edge" },
      { createdAt: cutoff + 1, url: "retained" },
    ]

    expect(selectExpiredLinks(links, cutoff)).toEqual([links[0]])
  })
})
