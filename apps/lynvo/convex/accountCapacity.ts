import type { MutationCtx } from "./_generated/server"
import { internalMutation } from "./_generated/server"
import { MAX_REGISTERED_ACCOUNTS } from "./constants"

const CAPACITY_KEY = "global" as const

const getCapacity = async (ctx: MutationCtx) => {
  const capacities = await ctx.db
    .query("accountCapacity")
    .withIndex("by_key", (queryBuilder) => queryBuilder.eq("key", CAPACITY_KEY))
    .take(1)
  return capacities[0] ?? null
}

export const reserveAccountCapacity = async (ctx: MutationCtx) => {
  const capacity = await getCapacity(ctx)
  if (capacity) {
    if (capacity.registeredAccounts >= MAX_REGISTERED_ACCOUNTS) {
      throw new Error(
        "Registration is temporarily closed because Lynvo has reached its account capacity."
      )
    }
    await ctx.db.patch("accountCapacity", capacity._id, {
      registeredAccounts: capacity.registeredAccounts + 1,
      updatedAt: Date.now(),
    })
    return
  }

  const existingAccounts = await ctx.db
    .query("users")
    .take(MAX_REGISTERED_ACCOUNTS)
  if (existingAccounts.length >= MAX_REGISTERED_ACCOUNTS) {
    throw new Error(
      "Registration is temporarily closed because Lynvo has reached its account capacity."
    )
  }
  await ctx.db.insert("accountCapacity", {
    key: CAPACITY_KEY,
    registeredAccounts: existingAccounts.length + 1,
    updatedAt: Date.now(),
  })
}

export const synchronizeAccountCapacityAfterCreation = async (
  ctx: MutationCtx
) => {
  const capacity = await getCapacity(ctx)
  if (capacity) {
    await reserveAccountCapacity(ctx)
    return
  }
  const existingAccounts = await ctx.db
    .query("users")
    .take(MAX_REGISTERED_ACCOUNTS + 1)
  if (existingAccounts.length > MAX_REGISTERED_ACCOUNTS) {
    throw new Error(
      "Registration is temporarily closed because Lynvo has reached its account capacity."
    )
  }
  await ctx.db.insert("accountCapacity", {
    key: CAPACITY_KEY,
    registeredAccounts: existingAccounts.length,
    updatedAt: Date.now(),
  })
}

export const releaseAccountCapacity = async (ctx: MutationCtx) => {
  const capacity = await getCapacity(ctx)
  if (!capacity) {
    return
  }
  await ctx.db.patch("accountCapacity", capacity._id, {
    registeredAccounts: Math.max(0, capacity.registeredAccounts - 1),
    updatedAt: Date.now(),
  })
}

export const reserve = internalMutation({
  args: {},
  handler: async (ctx) => {
    await reserveAccountCapacity(ctx)
    return null
  },
})

export const release = internalMutation({
  args: {},
  handler: async (ctx) => {
    await releaseAccountCapacity(ctx)
    return null
  },
})
