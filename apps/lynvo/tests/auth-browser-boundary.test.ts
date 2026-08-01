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
  it("contains no direct Convex auth, data hooks, or token persistence", () => {
    const forbiddenPatterns = [
      /from ["']convex\/react["']/,
      /from ["']@convex-dev\/auth\/react["']/,
      /__convexAuthJWT/,
      /__convexAuthRefreshToken/,
    ]
    const violations = collectBrowserSources("app").flatMap((path) => {
      const source = readFileSync(path, "utf8")
      return forbiddenPatterns.some((pattern) => pattern.test(source))
        ? [path]
        : []
    })

    expect(violations).toEqual([])
  })
})
