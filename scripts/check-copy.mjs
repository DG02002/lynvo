import { readFile, readdir } from "node:fs/promises"
import { extname, join } from "node:path"

const COPY_DIRECTORIES = [
  "apps/lynvo/app",
  "apps/lynvo/convex",
  "apps/lynvo/workers",
  "docs",
]
const COPY_FILES = ["CONTRIBUTING.md"]
const IGNORED_DIRECTORIES = new Set(["_generated"])
const SOURCE_EXTENSIONS = new Set([".md", ".mdx", ".ts", ".tsx"])
const FORBIDDEN_COPY_PATTERNS = [
  { label: "Sign-in", pattern: /\bSign-in\b/g },
  { label: "sign-in details", pattern: /\bsign-in details\b/g },
  { label: "Sign in", pattern: /\bSign in\b/g },
  { label: "Sign In", pattern: /\bSign In\b/g },
  { label: "Log In", pattern: /\bLog In\b/g },
  { label: "Signing in", pattern: /\bSigning in\b/g },
  { label: "Sign-out", pattern: /\bSign-out\b/g },
  { label: "sign-out", pattern: /\bsign-out\b/g },
  { label: "Signing out", pattern: /\bSigning out\b/g },
  { label: "signing out", pattern: /\bsigning out\b/g },
  { label: "Unknown Device", pattern: /\bUnknown Device\b/g },
]

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name) ||
          path === "apps/lynvo/app/components/ui"
          ? []
          : collectSourceFiles(path)
      }
      return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : []
    })
  )
  return nestedFiles.flat()
}

const sourceFiles = [
  ...(await Promise.all(COPY_DIRECTORIES.map(collectSourceFiles))).flat(),
  ...COPY_FILES,
]
const failures = []

for (const sourceFile of sourceFiles) {
  const source = await readFile(sourceFile, "utf8")
  const lines = source.split("\n")
  for (const { label, pattern } of FORBIDDEN_COPY_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split("\n").length
      failures.push(`${sourceFile}:${line}: replace forbidden copy “${label}”`)
    }
  }
  lines.forEach((lineText, lineIndex) => {
    if (/["'`]Loading(?![^"'`]*…)[^"'`]*["'`]/.test(lineText)) {
      failures.push(
        `${sourceFile}:${lineIndex + 1}: loading labels must end with an ellipsis`
      )
    }
  })
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else {
  console.log("Copy checks passed.")
}
