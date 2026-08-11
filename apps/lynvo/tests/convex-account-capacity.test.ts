// @vitest-environment edge-runtime

import {
  reserveAccountCapacity,
  synchronizeAccountCapacityAfterCreation,
} from "../convex/accountCapacity"
import { internal } from "../convex/_generated/api"
import { MAX_REGISTERED_ACCOUNTS } from "../convex/constants"
import { createConvexTest, insertTestUser } from "./convex-test-harness"

describe("account capacity", () => {
  it("initializes the post-create count to the exact user count", async () => {
    const convex = createConvexTest()
    await insertTestUser(convex, "first-created")
    await convex.run(synchronizeAccountCapacityAfterCreation)

    const capacity = await convex.run(async (context) =>
      context.db.query("accountCapacity").unique()
    )
    expect(capacity?.registeredAccounts).toBe(1)
  })
  it("initializes from existing accounts and reserves the new account slot", async () => {
    const convex = createConvexTest()
    await insertTestUser(convex, "existing-first")
    await insertTestUser(convex, "existing-second")

    await convex.run(async (context) => {
      await reserveAccountCapacity(context)
    })

    const capacity = await convex.run(
      async (context) =>
        await context.db
          .query("accountCapacity")
          .withIndex("by_key", (queryBuilder) =>
            queryBuilder.eq("key", "global")
          )
          .unique()
    )
    expect(capacity?.registeredAccounts).toBe(3)
  })

  it("rejects signup when every account slot is reserved", async () => {
    const convex = createConvexTest()
    await convex.run(async (context) => {
      await context.db.insert("accountCapacity", {
        key: "global",
        registeredAccounts: MAX_REGISTERED_ACCOUNTS,
        updatedAt: Date.now(),
      })
    })

    await expect(
      convex.run(async (context) => {
        await reserveAccountCapacity(context)
      })
    ).rejects.toThrow("Registration is temporarily closed")
  })

  it("makes a slot available after an account is deleted", async () => {
    vi.useFakeTimers()
    const convex = createConvexTest()
    const deleted = await insertTestUser(convex, "capacity-release")
    await convex.run(async (context) => {
      await context.db.insert("accountCapacity", {
        key: "global",
        registeredAccounts: MAX_REGISTERED_ACCOUNTS,
        updatedAt: Date.now(),
      })
    })
    await convex.mutation(internal.users.deleteUserData, {
      userId: deleted.userId,
    })
    await convex.mutation(internal.users.deleteUserData, {
      userId: deleted.userId,
    })
    await convex.finishAllScheduledFunctions(vi.runAllTimers)
    await convex.run(async (context) => {
      await reserveAccountCapacity(context)
    })

    const capacity = await convex.run(
      async (context) =>
        await context.db
          .query("accountCapacity")
          .withIndex("by_key", (queryBuilder) =>
            queryBuilder.eq("key", "global")
          )
          .unique()
    )
    expect(capacity?.registeredAccounts).toBe(1)
    vi.useRealTimers()
  })

  it.each([0, MAX_REGISTERED_ACCOUNTS])(
    "repairs a drifted capacity projection from %s",
    async (registeredAccounts) => {
      const convex = createConvexTest()
      await insertTestUser(convex, "first")
      await insertTestUser(convex, "second")
      await convex.run(async (context) => {
        await context.db.insert("accountCapacity", {
          key: "global",
          registeredAccounts,
          updatedAt: Date.now(),
        })
        await synchronizeAccountCapacityAfterCreation(context)
      })
      const capacity = await convex.run(async (context) =>
        context.db.query("accountCapacity").unique()
      )
      expect(capacity?.registeredAccounts).toBe(2)
    }
  )

  it("rejects duplicate capacity projections", async () => {
    const convex = createConvexTest()
    await convex.run(async (context) => {
      for (const updatedAt of [1, 2]) {
        await context.db.insert("accountCapacity", {
          key: "global",
          registeredAccounts: 0,
          updatedAt,
        })
      }
    })
    await expect(
      convex.run(synchronizeAccountCapacityAfterCreation)
    ).rejects.toThrow("unique() query returned more than one result")
  })
})
