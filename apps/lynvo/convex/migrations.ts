import { Migrations } from "@convex-dev/migrations"
import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import { internalQuery } from "./_generated/server"
import {
  calculateAppOwnedStorageUsage,
  getUserStorageLedger,
  upsertUserStorageLedger,
} from "./storagePolicy"
import {
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
  ledger.recentLinkBytes === usage.recentLinkBytes &&
  ledger.workerBytes === usage.workerBytes &&
  ledger.pluginDomainBytes === usage.pluginDomainBytes &&
  ledger.pluginCredentialBytes === usage.pluginCredentialBytes &&
  ledger.savedLinkCount === usage.savedLinkCount &&
  ledger.totalEnforcedBytes === usage.totalEnforcedBytes

export const backfillUserStorageLedgers = migrations.define({
  table: "users",
  batchSize: 10,
  migrateOne: async (ctx, user) => {
    const usage = await calculateAppOwnedStorageUsage(ctx, user._id)
    const ledger = await getUserStorageLedger(ctx, user._id)
    if (ledger && doesLedgerMatch(ledger, usage)) {
      return
    }
    await upsertUserStorageLedger(ctx, user._id, usage, Date.now())
  },
})

export const run = migrations.runner()

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
