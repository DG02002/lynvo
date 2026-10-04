import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

describe("dev launcher seed flag", () => {
  it("rejects a value after --seed before running migrations", () => {
    const result = spawnSync(
      "node",
      ["scripts/start-local-dev.mjs", "--seed", "docs"],
      {
        encoding: "utf8",
        timeout: 15_000,
      }
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "Error: `--seed` takes no value; the docs scenario runs automatically. Usage: pnpm dev --seed"
    )
  })
})
