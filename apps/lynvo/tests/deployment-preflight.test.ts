import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"

const scriptPath = resolve("scripts/deployment-preflight.mjs")
const lynvoConfig = readFileSync(resolve("wrangler.jsonc"), "utf8")
const lynvoPluginServerConfig = readFileSync(
  resolve("../lynvo-plugin-server/wrangler.jsonc"),
  "utf8"
)

const runPreflight = (lynvo: string, lynvoPluginServer: string) => {
  const directory = mkdtempSync(join(tmpdir(), "lynvo-preflight-"))
  const lynvoPath = join(directory, "lynvo.jsonc")
  const lynvoPluginServerPath = join(directory, "lynvo-plugin-server.jsonc")
  writeFileSync(lynvoPath, lynvo)
  writeFileSync(lynvoPluginServerPath, lynvoPluginServer)
  return spawnSync(
    process.execPath,
    [scriptPath, lynvoPath, lynvoPluginServerPath],
    { encoding: "utf8" }
  )
}

describe("deployment preflight command", () => {
  it("accepts the intended private production topology", () => {
    expect(runPreflight(lynvoConfig, lynvoPluginServerConfig).status).toBe(0)
  })

  it.each([
    [
      "placeholder",
      lynvoConfig.replace("0x4AAAAAAEC1SvszqvkGdIr2", "REPLACE_WITH_SITE_KEY"),
      lynvoPluginServerConfig,
    ],
    [
      "empty site key",
      lynvoConfig.replace("0x4AAAAAAEC1SvszqvkGdIr2", ""),
      lynvoPluginServerConfig,
    ],
    [
      "missing limiter",
      lynvoConfig.replace(
        '"name": "AUTH_RATE_LIMITER"',
        '"name": "MISSING_LIMITER"'
      ),
      lynvoPluginServerConfig,
    ],
    [
      "missing session binding",
      lynvoConfig.replace(
        '"name": "WORKER_AUTH_SESSION"',
        '"name": "MISSING_SESSION"'
      ),
      lynvoPluginServerConfig,
    ],
    [
      "missing credential vault binding",
      lynvoConfig.replace(
        '"name": "PLUGIN_SERVER_CREDENTIAL_VAULT"',
        '"name": "MISSING_CREDENTIAL_VAULT"'
      ),
      lynvoPluginServerConfig,
    ],
    [
      "missing session key declaration",
      lynvoConfig.replace('"AUTH_SESSION_MASTER_KEY",', ""),
      lynvoPluginServerConfig,
    ],
    [
      "wrong service",
      lynvoConfig.replace(
        '"service": "lynvo-plugin-server"',
        '"service": "wrong-plugin-server"'
      ),
      lynvoPluginServerConfig,
    ],
    [
      "public Plugin Server",
      lynvoConfig,
      lynvoPluginServerConfig.replace(
        '"workers_dev": false',
        '"workers_dev": true'
      ),
    ],
    [
      "wrong origin",
      lynvoConfig,
      lynvoPluginServerConfig.replace(
        "https://lynvo.dg02002.workers.dev/lynvo-plugin-server-assets",
        "https://wrong.example/assets"
      ),
    ],
    [
      "empty origin",
      lynvoConfig,
      lynvoPluginServerConfig.replace(
        "https://lynvo.dg02002.workers.dev/lynvo-plugin-server-assets",
        ""
      ),
    ],
  ])("rejects %s configuration", (_name, lynvo, lynvoPluginServer) => {
    const result = runPreflight(lynvo, lynvoPluginServer)
    expect(result.status).not.toBe(0)
    expect(result.stderr).not.toContain("0x4AAAAAAEC1SvszqvkGdIr2")
  })
})
