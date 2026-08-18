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
  it("allows one memory-only Convex provider and no token persistence", () => {
    const forbiddenPatterns = [
      /from ["']@convex-dev\/auth\/react["']/,
      /__convexAuthJWT/,
      /__convexAuthRefreshToken/,
      /localStorage.*[Tt]oken/,
      /indexedDB.*[Tt]oken/,
    ]
    const convexReactImports: string[] = []
    const violations = collectBrowserSources("app").flatMap((path) => {
      const source = readFileSync(path, "utf8")
      if (/from ["']convex\/react["']/.test(source)) {
        convexReactImports.push(path)
      }
      return forbiddenPatterns.some((pattern) => pattern.test(source))
        ? [path]
        : []
    })

    expect(violations).toEqual([])
    expect(convexReactImports).toContain(
      "app/root/convex-authentication-provider.tsx"
    )
  })
})
