import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const createFixture = ({
  omitStorage = false,
  usesSharedErasureRegistry = true,
  extraSource,
}: {
  omitStorage?: boolean
  usesSharedErasureRegistry?: boolean
  extraSource?: string
}) => {
  const directory = mkdtempSync(join(tmpdir(), "lynvo-contract-audit-"))
  writeFileSync(
    join(directory, "schema.ts"),
    "export default {\n  users: defineTable({}),\n}"
  )
  writeFileSync(
    join(directory, "accountDataOwnership.ts"),
    `export const ACCOUNT_DATA_CATALOG = { users: { lifecycle: "erased"${omitStorage ? "" : ', storage: "profileBytes"'} } } as const satisfies Record<string, unknown>`
  )
  writeFileSync(
    join(directory, "storagePolicy.ts"),
    'import { ACCOUNT_DATA_STORAGE_REGISTRY } from "./accountDataOwnership"'
  )
  writeFileSync(
    join(directory, "accountErasure.ts"),
    usesSharedErasureRegistry
      ? 'import { ACCOUNT_ERASURE_TABLES } from "./accountDataOwnership"'
      : "export const ACCOUNT_ERASURE_TABLES = [] as const"
  )
  if (extraSource) {
    writeFileSync(join(directory, "unsafe.ts"), extraSource)
  }
  return directory
}

const runAudit = (directory: string) =>
  execFileSync("node", ["scripts/audit-convex-contracts.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONVEX_CONTRACT_AUDIT_DIRECTORY: directory,
    },
    stdio: "pipe",
  })

describe("Convex contract audit", () => {
  it("rejects a one-argument database operation", () => {
    const directory = createFixture({
      extraSource: `export const unsafe = query({
        args: {},
        returns: v.null(),
        handler: async (ctx, args) => ctx.db.get(args.id),
      })`,
    })
    try {
      expect(() => runAudit(directory)).toThrow()
    } finally {
      rmSync(directory, { recursive: true })
    }
  })

  it("rejects erased tables missing storage classification", () => {
    const directory = createFixture({ omitStorage: true })
    try {
      expect(() => runAudit(directory)).toThrow()
    } finally {
      rmSync(directory, { recursive: true })
    }
  })

  it("rejects erasure implementations that do not use the shared registry", () => {
    const directory = createFixture({ usesSharedErasureRegistry: false })
    try {
      expect(() => runAudit(directory)).toThrow()
    } finally {
      rmSync(directory, { recursive: true })
    }
  })
})
