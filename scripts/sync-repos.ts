import { execSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const REPOS = [
  {
    id: "effect-smol",
    repository: "https://github.com/Effect-TS/effect-smol.git",
    path: ".repos/effect-smol",
  },
]

function runCommand(command: string, cwd?: string) {
  try {
    console.log(`Running: ${command} ${cwd ? `in ${cwd}` : ""}`)
    execSync(command, { stdio: "inherit", cwd })
  } catch (error) {
    console.error(`Command failed: ${command}`, error)
    process.exit(1)
  }
}

function main() {
  const rootDir = join(import.meta.dirname, "..")
  const reposDir = join(rootDir, ".repos")

  if (!existsSync(reposDir)) {
    console.log(`Creating directory: ${reposDir}`)
    mkdirSync(reposDir, { recursive: true })
  }

  const args = process.argv.slice(2)
  const repoFlagIndex = args.indexOf("--repo")
  const targetRepoId = repoFlagIndex !== -1 ? args[repoFlagIndex + 1] : null

  const reposToSync = targetRepoId
    ? REPOS.filter((r) => r.id === targetRepoId)
    : REPOS

  if (targetRepoId && reposToSync.length === 0) {
    console.error(
      `Error: Repository with ID "${targetRepoId}" is not configured.`
    )
    process.exit(1)
  }

  for (const repo of reposToSync) {
    const fullPath = join(rootDir, repo.path)
    console.log(`\nSyncing [${repo.id}] into ${repo.path}...`)

    if (!existsSync(fullPath)) {
      // Shallow clone for speed and minimal disk space
      runCommand(`git clone --depth 1 ${repo.repository} ${repo.path}`, rootDir)
    } else {
      // Pull updates if it already exists
      runCommand("git pull", fullPath)
    }
  }

  console.log("\nRepository sync complete!")
}

main()
