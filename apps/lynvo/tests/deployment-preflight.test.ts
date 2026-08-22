import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"

const scriptPath = resolve("scripts/deployment-preflight.mjs")
const packageConfig = JSON.parse(readFileSync(resolve("package.json"), "utf8"))
const lynvoConfig = readFileSync(resolve("wrangler.jsonc"), "utf8")

const runPreflight = (
  lynvo: string,
  identity = { commitHash: "abc123", serviceVersion: "2026.08.18" }
) => {
  const directory = mkdtempSync(join(tmpdir(), "lynvo-preflight-"))
  const lynvoPath = join(directory, "lynvo.jsonc")
  writeFileSync(lynvoPath, lynvo)
  return spawnSync(process.execPath, [scriptPath, lynvoPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      COMMIT_HASH: identity.commitHash,
      SERVICE_VERSION: identity.serviceVersion,
    },
  })
}

const validLynvoConfig = lynvoConfig.replace(
  /"database_id":\s*"[^"]+"/,
  '"database_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"'
)

describe("deployment preflight command", () => {
  it("accepts the intended private production topology", () => {
    expect(runPreflight(validLynvoConfig).status).toBe(0)
  })

  it.each([
    ["unknown commit", { commitHash: "unknown", serviceVersion: "2026.08.18" }],
    ["missing commit", { commitHash: "", serviceVersion: "2026.08.18" }],
    ["fixed version", { commitHash: "abc123", serviceVersion: "0.1.0" }],
    ["missing version", { commitHash: "abc123", serviceVersion: "" }],
  ])("rejects %s release identity", (_name, identity) => {
    expect(runPreflight(validLynvoConfig, identity).status).not.toBe(0)
  })

  it("passes the verified release identity to Wrangler", () => {
    expect(packageConfig.scripts.deploy).toContain(
      'wrangler deploy --config build/server/wrangler.json --env="" --var "COMMIT_HASH:$COMMIT_HASH" --var "SERVICE_VERSION:$SERVICE_VERSION"'
    )
  })

  it.each([
    [
      "missing D1 binding",
      validLynvoConfig.replace('"binding": "DB"', '"binding": "MISSING_DB"'),
    ],
    [
      "missing limiter",
      validLynvoConfig.replace(
        '"name": "AUTH_RATE_LIMITER"',
        '"name": "MISSING_LIMITER"'
      ),
    ],
    [
      "missing credential vault binding",
      validLynvoConfig.replace(
        '"name": "PLUGIN_SERVER_CREDENTIAL_VAULT"',
        '"name": "MISSING_CREDENTIAL_VAULT"'
      ),
    ],
    [
      "missing realtime room binding",
      validLynvoConfig.replace(
        '"name": "USER_REALTIME_ROOM"',
        '"name": "MISSING_REALTIME_ROOM"'
      ),
    ],
    [
      "wrong service",
      validLynvoConfig.replace(
        '"service": "lynvo-plugin-server"',
        '"service": "wrong-plugin-server"'
      ),
    ],
    [
      "placeholder database id (REPLACE_WITH)",
      validLynvoConfig.replace(
        '"database_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"',
        '"database_id": "REPLACE_WITH_DATABASE_ID"'
      ),
    ],
    [
      "placeholder database id (zeroes)",
      validLynvoConfig.replace(
        '"database_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"',
        '"database_id": "00000000-0000-0000-0000-000000000000"'
      ),
    ],
  ])("rejects %s configuration", (_name, lynvo) => {
    expect(runPreflight(lynvo).status).not.toBe(0)
  })
})
