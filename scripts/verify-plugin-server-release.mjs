import { execFileSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const workspaceRoot = join(fileURLToPath(new URL("..", import.meta.url)))
const temporaryRoot = mkdtempSync(
  join(tmpdir(), "lynvo-plugin-server-release-")
)

const run = (command, argumentsList, cwd = workspaceRoot) => {
  execFileSync(command, argumentsList, {
    cwd,
    env: process.env,
    stdio: "inherit",
  })
}

const findTarball = (packageDirectory, packagePrefix) => {
  const tarball = readdirSync(packageDirectory).find(
    (file) => file.startsWith(packagePrefix) && file.endsWith(".tgz")
  )
  if (!tarball) {
    throw new Error(`could not find packed ${packagePrefix} tarball`)
  }
  return join(packageDirectory, tarball)
}

try {
  const protocolDirectory = join(temporaryRoot, "protocol")
  const creatorDirectory = join(temporaryRoot, "creator")
  mkdirSync(protocolDirectory)
  mkdirSync(creatorDirectory)
  run("pnpm", [
    "--filter",
    "@dg02002/lynvo-plugin-server-protocol",
    "pack",
    "--pack-destination",
    protocolDirectory,
  ])
  run("pnpm", [
    "--filter",
    "create-lynvo-plugin-server",
    "pack",
    "--pack-destination",
    creatorDirectory,
  ])

  const protocolTarball = findTarball(
    protocolDirectory,
    "dg02002-lynvo-plugin-server-protocol-"
  )
  const creatorTarball = findTarball(
    creatorDirectory,
    "create-lynvo-plugin-server-"
  )
  const consumerPackage = {
    name: "lynvo-plugin-server-release-consumer",
    version: "0.0.0",
    private: true,
  }
  writeFileSync(
    join(temporaryRoot, "package.json"),
    `${JSON.stringify(consumerPackage, null, 2)}\n`
  )
  run(
    "pnpm",
    ["add", `create-lynvo-plugin-server@file:${creatorTarball}`, "--ignore-scripts"],
    temporaryRoot
  )
  run(
    "pnpm",
    [
      "exec",
      "create-lynvo-plugin-server",
      "generated-plugin",
      "--skip-install",
    ],
    temporaryRoot
  )

  const generatedPackagePath = join(
    temporaryRoot,
    "generated-plugin",
    "package.json"
  )
  const generatedPackageSource = readFileSync(generatedPackagePath, "utf8")
  if (/(?:workspace:|link:|lynvo-mix)/.test(generatedPackageSource)) {
    throw new Error(
      "generated package contains a workspace or local Lynvo dependency"
    )
  }

  run(
    "pnpm",
    [
      "add",
      `@dg02002/lynvo-plugin-server-protocol@file:${protocolTarball}`,
      "--save-exact",
    ],
    join(temporaryRoot, "generated-plugin")
  )
  run("pnpm", ["check"], join(temporaryRoot, "generated-plugin"))
  run("pnpm", ["test"], join(temporaryRoot, "generated-plugin"))
  run("pnpm", ["build"], join(temporaryRoot, "generated-plugin"))

  console.log(
    "Packed protocol and creator packages passed the standalone smoke test."
  )
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
