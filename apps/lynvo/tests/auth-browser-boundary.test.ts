import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const collectBrowserSources = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      return collectBrowserSources(path)
    }
    return /\.(ts|tsx)$/.test(entry) ? [path] : []
  })

describe("browser authentication boundary", () => {
  it("keeps tokens out of browser-readable storage", () => {
    const forbiddenPatterns = [
      /localStorage.*[Tt]oken/,
      /indexedDB.*[Tt]oken/,
    ]
    const violations = collectBrowserSources("app").flatMap((path) =>
      forbiddenPatterns.some((pattern) => pattern.test(source(path)))
        ? [path]
        : []
    )

    expect(violations).toEqual([])
  })
})

const source = (path: string): string => readFileSync(path, "utf8")
