import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"

const scriptPath = resolve("scripts/deployment-preflight.mjs")
const lynvoConfig = readFileSync(resolve("wrangler.jsonc"), "utf8")
const officialConfig = readFileSync(
  resolve("../official-extractor/wrangler.jsonc"),
  "utf8"
)

const runPreflight = (lynvo: string, official: string) => {
  const directory = mkdtempSync(join(tmpdir(), "lynvo-preflight-"))
  const lynvoPath = join(directory, "lynvo.jsonc")
  const officialPath = join(directory, "official.jsonc")
  writeFileSync(lynvoPath, lynvo)
  writeFileSync(officialPath, official)
  return spawnSync(process.execPath, [scriptPath, lynvoPath, officialPath], {
    encoding: "utf8",
  })
}

describe("deployment preflight command", () => {
  it("accepts the intended private production topology", () => {
    expect(runPreflight(lynvoConfig, officialConfig).status).toBe(0)
  })

  it.each([
    ["placeholder", lynvoConfig.replace("0x4AAAAAAEC1SvszqvkGdIr2", "REPLACE_WITH_SITE_KEY"), officialConfig],
    ["empty site key", lynvoConfig.replace("0x4AAAAAAEC1SvszqvkGdIr2", ""), officialConfig],
    ["missing limiter", lynvoConfig.replace('"name": "AUTH_RATE_LIMITER"', '"name": "MISSING_LIMITER"'), officialConfig],
    ["missing session binding", lynvoConfig.replace('"name": "WORKER_AUTH_SESSION"', '"name": "MISSING_SESSION"'), officialConfig],
    ["missing credential vault binding", lynvoConfig.replace('"name": "EXTERNAL_WORKER_CREDENTIAL_VAULT"', '"name": "MISSING_CREDENTIAL_VAULT"'), officialConfig],
    ["missing session key declaration", lynvoConfig.replace('"AUTH_SESSION_MASTER_KEY",', ""), officialConfig],
    ["wrong service", lynvoConfig.replace('"service": "lynvo-official-extractor"', '"service": "wrong-extractor"'), officialConfig],
    ["public extractor", lynvoConfig, officialConfig.replace('"workers_dev": false', '"workers_dev": true')],
    ["wrong origin", lynvoConfig, officialConfig.replace("https://lynvo.dg02002.workers.dev/official-extractor-assets", "https://wrong.example/assets")],
    ["empty origin", lynvoConfig, officialConfig.replace("https://lynvo.dg02002.workers.dev/official-extractor-assets", "")],
  ])("rejects %s configuration", (_name, lynvo, official) => {
    const result = runPreflight(lynvo, official)
    expect(result.status).not.toBe(0)
    expect(result.stderr).not.toContain("0x4AAAAAAEC1SvszqvkGdIr2")
  })
})
