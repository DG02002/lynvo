import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

const runDevLauncher = (arguments_: readonly string[]) => {
  const environment = { ...process.env }
  delete environment.LYNVO_SEED_ORIGIN
  return spawnSync("node", ["scripts/start-local-dev.mjs", ...arguments_], {
    encoding: "utf8",
    env: environment,
    timeout: 15_000,
  })
}

describe("dev launcher seed flag", () => {
  it("rejects a value after --seed before running migrations", () => {
    const result = runDevLauncher(["--seed", "docs"])

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "Error: `--seed` takes no value; the docs scenario runs automatically. Usage: pnpm dev --seed"
    )
    expect(result.stderr).not.toContain("wrangler")
  })

  it("rejects a seed origin that disagrees with the requested dev server port", () => {
    const result = runDevLauncher(["--seed", "--port", "5175"])

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "Error: The seed writes to http://localhost:5173, but the dev server will use port 5175."
    )
    expect(result.stderr).toContain(
      "Set LYNVO_SEED_ORIGIN to http://localhost:5175 or drop --port."
    )
  })
})
