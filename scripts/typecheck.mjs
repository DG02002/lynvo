import { spawnSync } from "node:child_process"

const IGNORED_DIAGNOSTIC_PREFIXES = ["app/components/ui/"]
const TYPESCRIPT_DIAGNOSTIC_PATTERN = /^([^\r\n(]+)\(\d+,\d+\): error TS\d+:/

const result = spawnSync("tsc", ["-b", "--pretty", "false"], {
  encoding: "utf8",
  shell: process.platform === "win32",
})

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
let isIgnoringDiagnostic = false
const remainingLines = output.split(/\r?\n/).filter((line) => {
  const diagnosticMatch = line.match(TYPESCRIPT_DIAGNOSTIC_PATTERN)

  if (diagnosticMatch) {
    isIgnoringDiagnostic = IGNORED_DIAGNOSTIC_PREFIXES.some((prefix) =>
      diagnosticMatch[1].startsWith(prefix)
    )
  }

  return !isIgnoringDiagnostic
})
const remainingOutput = remainingLines.join("\n").trim()

if (remainingOutput) {
  console.error(remainingOutput)
  process.exitCode = result.status ?? 1
} else if (result.error) {
  console.error(result.error.message)
  process.exitCode = 1
}
