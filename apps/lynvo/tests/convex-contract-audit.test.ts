import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("Convex contract audit", () => {
  it("rejects a one-argument database operation", () => {
    const fixtureDirectory = mkdtempSync(join(tmpdir(), "lynvo-contract-audit-"))
    writeFileSync(
      join(fixtureDirectory, "unsafe.ts"),
      `export const unsafe = query({
        args: {},
        returns: v.null(),
        handler: async (ctx, args) => ctx.db.get(args.id),
      })`
    )

    try {
      expect(() =>
        execFileSync("node", ["scripts/audit-convex-contracts.mjs"], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            CONVEX_CONTRACT_AUDIT_DIRECTORY: fixtureDirectory,
          },
          stdio: "pipe",
        })
      ).toThrow()
    } finally {
      rmSync(fixtureDirectory, { recursive: true })
    }
  })
})
