#!/usr/bin/env node

import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const templateRoot = join(packageRoot, "template")
const require = createRequire(import.meta.url)
const packageJson = require(join(packageRoot, "package.json"))
const protocolPackageVersion = packageJson.lynvo?.protocolPackageVersion

const TEXT_EXTENSIONS = new Set([
  ".example",
  ".json",
  ".jsonc",
  ".md",
  ".ts",
  ".txt",
])

const fail = (message) => {
  console.error(`create-lynvo-plugin-server: ${message}`)
  process.exitCode = 1
}

const printHelp = () => {
  console.log(`Usage: pnpm create lynvo-plugin-server <project-directory> [options]

Create a standalone Lynvo-compatible Cloudflare Worker.

Options:
  --skip-install, --no-install  Generate files without running pnpm install
  --force                       Allow overwriting files in a non-empty directory
  --help                        Show this help
  --version                     Show the creator version`)
}

const parseArguments = (argumentsList) => {
  const positionals = []
  const options = { force: false, skipInstall: false }

  for (const argument of argumentsList) {
    if (argument === "--") continue
    if (argument === "--help" || argument === "-h") {
      options.help = true
      continue
    }
    if (argument === "--version" || argument === "-v") {
      options.version = true
      continue
    }
    if (argument === "--force") {
      options.force = true
      continue
    }
    if (argument === "--skip-install" || argument === "--no-install") {
      options.skipInstall = true
      continue
    }
    if (argument.startsWith("-")) {
      throw new Error(`unknown option: ${argument}`)
    }
    positionals.push(argument)
  }

  if (positionals.length > 1) {
    throw new Error("expected one project directory")
  }

  return { destinationArgument: positionals[0], options }
}

const validateProjectName = (projectName) => {
  if (!projectName || projectName === "." || projectName === "..") {
    throw new Error("project name is required")
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(projectName)) {
    throw new Error(
      `invalid project name "${projectName}"; use lowercase letters, numbers, dots, hyphens, or underscores`
    )
  }
  if (projectName.startsWith(".") || projectName.startsWith("_")) {
    throw new Error(`invalid project name "${projectName}"`)
  }
}

const getDestination = (destinationArgument) => {
  if (!destinationArgument) throw new Error("project directory is required")
  if (destinationArgument.startsWith("-")) {
    throw new Error("project directory must not start with a dash")
  }

  const destination = resolve(process.cwd(), destinationArgument)
  const projectName = basename(destination)
  validateProjectName(projectName)

  if (destination === resolve(process.cwd())) {
    throw new Error("refusing to generate into the current directory")
  }

  return { destination, projectName }
}

const isDirectoryEmpty = async (directory) => {
  try {
    return (await readdir(directory)).length === 0
  } catch (error) {
    if (error.code === "ENOENT") return true
    throw error
  }
}

const ensureDestination = async (destination, force) => {
  let destinationStats
  try {
    destinationStats = await stat(destination)
  } catch (error) {
    if (error.code === "ENOENT") {
      await mkdir(destination, { recursive: true })
      return
    }
    throw error
  }

  if (!destinationStats.isDirectory()) {
    throw new Error(`destination is not a directory: ${destination}`)
  }

  if (!(await isDirectoryEmpty(destination)) && !force) {
    throw new Error(
      `destination is not empty: ${destination}; choose another directory or pass --force`
    )
  }
}

const displayNameFor = (projectName) =>
  projectName
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ")

const replaceTemplateTokens = (content, values) => {
  let result = content
  for (const [token, value] of Object.entries(values)) {
    result = result.replaceAll(token, value)
  }
  return result
}

const copyTemplate = async (destination, values) => {
  const entries = await readdir(templateRoot, {
    withFileTypes: true,
    recursive: true,
  })

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const source = join(entry.parentPath, entry.name)
    const templatePath = relative(templateRoot, source)
    const relativePath =
      templatePath === "gitignore" ? ".gitignore" : templatePath
    const target = join(destination, relativePath)
    await mkdir(dirname(target), { recursive: true })

    if (
      TEXT_EXTENSIONS.has(extname(entry.name)) ||
      entry.name === ".gitignore"
    ) {
      const content = replaceTemplateTokens(
        await readFile(source, "utf8"),
        values
      )
      await writeFile(target, content)
    } else {
      await cp(source, target)
    }
  }
}

const runInstall = (destination) =>
  new Promise((resolveInstall, rejectInstall) => {
    const child = spawn("pnpm", ["install"], {
      cwd: destination,
      env: process.env,
      stdio: "inherit",
    })
    child.once("error", rejectInstall)
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveInstall()
      } else {
        rejectInstall(
          new Error(
            `pnpm install failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`
          )
        )
      }
    })
  })

const main = async () => {
  const { destinationArgument, options } = parseArguments(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }
  if (options.version) {
    console.log(packageJson.version)
    return
  }
  if (!protocolPackageVersion) {
    throw new Error("creator package is missing lynvo.protocolPackageVersion")
  }

  const { destination, projectName } = getDestination(destinationArgument)
  await ensureDestination(destination, options.force)

  const values = {
    __PROJECT_NAME__: projectName,
    __PROJECT_DISPLAY_NAME__: displayNameFor(projectName),
    __PROJECT_SERVER_ID__: `com.example.${projectName}`,
    __LYNVO_PROTOCOL_VERSION__: protocolPackageVersion,
  }
  await copyTemplate(destination, values)

  if (!options.skipInstall) {
    await runInstall(destination)
  }

  const printedPath = relative(process.cwd(), destination) || "."
  console.log(`\nCreated ${projectName} in ${printedPath}`)
  if (options.skipInstall) {
    console.log("\nInstallation skipped.")
  }
  console.log(`\nNext steps:
  cd ${isAbsolute(destinationArgument) ? destination : printedPath}
  pnpm install
  pnpm dev

In another terminal, run:
  pnpm test
  pnpm build
  pnpm deploy`)
}

try {
  await main()
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
