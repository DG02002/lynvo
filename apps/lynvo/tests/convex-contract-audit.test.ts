import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const createFixture = ({
  storageTables = ["users"],
  erasureTables = ["users"],
  extraSource,
}: {
  storageTables?: string[]
  erasureTables?: string[]
  extraSource?: string
}) => {
  const directory = mkdtempSync(join(tmpdir(), "lynvo-contract-audit-"))
  writeFileSync(
    join(directory, "schema.ts"),
    "export default {\n  users: defineTable({}),\n}"
  )
  writeFileSync(
    join(directory, "accountDataOwnership.ts"),
    'export const ACCOUNT_DATA_OWNERSHIP = { erased: ["users"], operational: [], global: [] }'
  )
  writeFileSync(
    join(directory, "storagePolicy.ts"),
    `export const STORAGE_DOMAIN_REGISTRY = { ${storageTables
      .map((table) => `${table}: "profileBytes"`)
      .join(",")} } as const`
  )
  writeFileSync(
    join(directory, "accountErasure.ts"),
    `export const ACCOUNT_ERASURE_TABLES = [${erasureTables
      .map((table) => `"${table}"`)
      .join(",")}] as const`
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
    const directory = createFixture({ storageTables: [] })
    try {
      expect(() => runAudit(directory)).toThrow()
    } finally {
      rmSync(directory, { recursive: true })
    }
  })

  it("rejects erased tables missing erasure coverage", () => {
    const directory = createFixture({ erasureTables: [] })
    try {
      expect(() => runAudit(directory)).toThrow()
    } finally {
      rmSync(directory, { recursive: true })
    }
  })
})
