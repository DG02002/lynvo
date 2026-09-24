import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("seed CLI scenario selection", () => {
  it("rejects an unregistered scenario with the available usage", () => {
    const result = spawnSync(
      "pnpm",
      ["--filter", "@lynvo/app", "seed", "unknown"],
      {
        cwd: resolve("../.."),
        encoding: "utf8",
        timeout: 15_000,
      }
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "Usage: pnpm --filter @lynvo/app seed <docs>"
    )
    expect(result.stderr).toContain(
      "Error: Usage: pnpm --filter @lynvo/app seed <docs>"
    )
  })
})
