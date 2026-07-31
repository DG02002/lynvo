import { readFile, readdir } from "node:fs/promises"
import { extname, join } from "node:path"

const COPY_DIRECTORIES = [
  "apps/lynvo/app/components/auth",
  "apps/lynvo/app/components/remote-play",
  "apps/lynvo/app/features/auth",
]
const COPY_FILES = [
  "apps/lynvo/app/components/RemotePlayButton.tsx",
  "apps/lynvo/app/context/RemoteControlContext.tsx",
  "apps/lynvo/app/context/remote-control/machine.ts",
  "apps/lynvo/app/lib/auth-errors.ts",
  "apps/lynvo/app/lib/auth-form-schemas.ts",
  "apps/lynvo/app/lib/device-name.ts",
]
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"])
const FORBIDDEN_COPY_PATTERNS = [
  { label: "Sign in", pattern: /\bSign in\b/g },
  { label: "Sign In", pattern: /\bSign In\b/g },
  { label: "Log In", pattern: /\bLog In\b/g },
  { label: "Signing in", pattern: /\bSigning in\b/g },
  { label: "Unknown Device", pattern: /\bUnknown Device\b/g },
]

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return collectSourceFiles(path)
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
    if (/Loading[^…"'`}]*["'`}]/.test(lineText)) {
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
