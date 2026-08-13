import assert from "node:assert/strict"
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"
import { test, after } from "node:test"

const packageRoot = fileURLToPath(new URL("..", import.meta.url))
const cli = join(packageRoot, "bin/create-lynvo-plugin-server.mjs")
const temporaryDirectories = []

const run = (args, cwd) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.stderr.on("data", (chunk) => (stderr += chunk))
    child.once("error", rejectRun)
    child.once("exit", (code) => resolveRun({ code, stdout, stderr }))
  })

const makeTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), "lynvo-create-test-"))
  temporaryDirectories.push(directory)
  return directory
}

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

test("generates a standalone project with a semver protocol dependency", async () => {
  const root = await makeTemporaryDirectory()
  const result = await run(["my-plugin-server", "--skip-install"], root)
  assert.equal(result.code, 0, result.stderr)

  const destination = join(root, "my-plugin-server")
  const packageJson = JSON.parse(
    await readFile(join(destination, "package.json"), "utf8")
  )
  assert.equal(packageJson.name, "my-plugin-server")
  assert.equal(
    packageJson.dependencies["@dg02002/lynvo-plugin-server-protocol"],
    "^0.1.1"
  )
  assert.equal(packageJson.dependencies.hono, "^4.13.1")
  assert.equal(packageJson.devDependencies.sharp, "^0.35.3")
  assert.equal(
    packageJson.scripts["images:optimize"],
    "node scripts/optimize-images.mjs public/icons/sources"
  )
  assert.equal(packageJson.packageManager, undefined)

  const generatedFiles = await readdir(destination)
  assert(generatedFiles.includes(".dev.vars.example"))
  assert(generatedFiles.includes(".gitignore"))
  assert(generatedFiles.includes("README.md"))
  assert.match(
    await readFile(join(destination, "scripts/optimize-images.mjs"), "utf8"),
    /sharp/
  )
  assert.match(
    await readFile(join(destination, "src/index.ts"), "utf8"),
    /my-plugin-server/
  )
  assert.doesNotMatch(
    await readFile(join(destination, "package.json"), "utf8"),
    /(?:workspace:|link:|lynvo-mix)/
  )
  assert.match(result.stdout, /pnpm test/)
  assert.match(result.stdout, /pnpm deploy/)
})

test("refuses an invalid name and a non-empty destination", async () => {
  const root = await makeTemporaryDirectory()
  const invalid = await run(["Invalid Name", "--skip-install"], root)
  assert.notEqual(invalid.code, 0)
  assert.match(invalid.stderr, /invalid project name/)

  const destination = join(root, "existing-project")
  await mkdir(destination)
  await writeFile(join(destination, "marker"), "keep")
  const refused = await run(["existing-project", "--skip-install"], root)
  assert.notEqual(refused.code, 0)
  assert.match(refused.stderr, /destination is not empty/)

  const forced = await run(
    ["existing-project", "--skip-install", "--force"],
    root
  )
  assert.equal(forced.code, 0, forced.stderr)
  assert.equal(await readFile(join(destination, "marker"), "utf8"), "keep")
  assert.equal(
    await readFile(join(destination, "package.json"), "utf8")
      .then(JSON.parse)
      .then((value) => value.name),
    "existing-project"
  )
})

test("rejects a second generation without force", async () => {
  const root = await makeTemporaryDirectory()
  const first = await run(["repeat-project", "--skip-install"], root)
  assert.equal(first.code, 0, first.stderr)
  const second = await run(["repeat-project", "--skip-install"], root)
  assert.notEqual(second.code, 0)
  assert.match(second.stderr, /destination is not empty/)
})
