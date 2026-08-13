import { Migrations } from "@convex-dev/migrations"
import { v } from "convex/values"
import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import { internalQuery } from "./_generated/server"
import {
  calculateAppOwnedStorageUsage,
  getUserStorageLedger,
  upsertUserStorageLedger,
} from "./storagePolicy"
import {
  DEFAULT_RETENTION_DAYS,
  MAX_REGISTERED_ACCOUNTS,
  STORAGE_RETENTION_DAY_OPTIONS,
  STORAGE_LEDGER_SCHEMA_VERSION,
  STORAGE_LEDGER_VERIFICATION_USER_LIMIT,
} from "./constants"

const migrations = new Migrations<DataModel>(components.migrations)

const doesLedgerMatch = (
  ledger: NonNullable<Awaited<ReturnType<typeof getUserStorageLedger>>>,
  usage: AppOwnedStorageUsage
) =>
  ledger.schemaVersion === STORAGE_LEDGER_SCHEMA_VERSION &&
  ledger.profileBytes === usage.profileBytes &&
  ledger.linkBytes === usage.linkBytes &&
  ledger.pluginServerBytes === usage.pluginServerBytes &&
  ledger.pluginDomainBytes === usage.pluginDomainBytes &&
  ledger.pluginCredentialBytes === usage.pluginCredentialBytes &&
  ledger.savedLinkCount === usage.savedLinkCount &&
  ledger.totalEnforcedBytes === usage.totalEnforcedBytes

export const backfillUserStorageLedgers = migrations.define({
  table: "users",
  batchSize: 10,
  migrateOne: async (ctx, user) => {
    const [usage, ledger] = await Promise.all([
      calculateAppOwnedStorageUsage(ctx, user._id),
      getUserStorageLedger(ctx, user._id),
    ])
    if (ledger && doesLedgerMatch(ledger, usage)) {
      return
    }
    await upsertUserStorageLedger(ctx, user._id, usage, Date.now())
  },
})

export const normalizeSavedLinkRetention = migrations.define({
  table: "users",
  batchSize: 100,
  migrateOne: async (ctx, user) => {
    if (
      user.storageRetentionDays !== undefined &&
      STORAGE_RETENTION_DAY_OPTIONS.includes(user.storageRetentionDays)
    ) {
      return
    }
    await ctx.db.patch("users", user._id, {
      storageRetentionDays: DEFAULT_RETENTION_DAYS,
    })
  },
})

export const run = migrations.runner()

export const verifySavedLinkRetention = internalQuery({
  args: {},
  returns: v.object({
    checkedCount: v.number(),
    missingCount: v.number(),
    unsupportedCount: v.number(),
    isComplete: v.boolean(),
  }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(MAX_REGISTERED_ACCOUNTS + 1)
    const missingCount = users.filter(
      (user) => user.storageRetentionDays === undefined
    ).length
    const unsupportedCount = users.filter(
      (user) =>
        user.storageRetentionDays !== undefined &&
        !STORAGE_RETENTION_DAY_OPTIONS.includes(user.storageRetentionDays)
    ).length
    return {
      checkedCount: users.length,
      missingCount,
      unsupportedCount,
      isComplete:
        users.length <= MAX_REGISTERED_ACCOUNTS &&
        missingCount === 0 &&
        unsupportedCount === 0,
    }
  },
})

export const verifyUserStorageLedgers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .take(STORAGE_LEDGER_VERIFICATION_USER_LIMIT)
    let missingCount = 0
    let mismatchCount = 0
    for (const user of users) {
      const usage = await calculateAppOwnedStorageUsage(ctx, user._id)
      const ledger = await getUserStorageLedger(ctx, user._id)
      if (!ledger) {
        missingCount += 1
      } else if (!doesLedgerMatch(ledger, usage)) {
        mismatchCount += 1
      }
    }
    return {
      checkedCount: users.length,
      missingCount,
      mismatchCount,
      isComplete:
        users.length < STORAGE_LEDGER_VERIFICATION_USER_LIMIT &&
        missingCount === 0 &&
        mismatchCount === 0,
    }
  },
})
