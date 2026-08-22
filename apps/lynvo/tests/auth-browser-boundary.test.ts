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
  it("keeps the browser free of backend clients and token persistence", () => {
    const forbiddenPatterns = [
      /from ["']convex\/react["']/,
      /from ["']@tanstack\/react-query["']/,
      /__convexAuthJWT/,
      /__convexAuthRefreshToken/,
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
