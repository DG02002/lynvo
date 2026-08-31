import { describe, expect, it } from "vitest"
import routes from "~/routes"

type RouteEntry = (typeof routes)[number]

const flattenRouteEntries = (
  entries: readonly RouteEntry[]
): readonly RouteEntry[] =>
  entries.flatMap((entry) => [
    entry,
    ...(entry.children === undefined
      ? []
      : // SAFETY: react-router route configs nest children of the same shape.
        flattenRouteEntries(entry.children as readonly RouteEntry[])),
  ])

const flattenRoutePaths = (entries: readonly RouteEntry[]): string[] =>
  entries.flatMap((entry) => [
    ...(entry.path === undefined ? [] : [entry.path]),
  ])

const findRouteByFile = (suffix: string): RouteEntry | undefined =>
  flattenRouteEntries(routes).find((entry) => entry.file?.endsWith(suffix))

describe("route structure", () => {
  it("exposes the public device-login and license routes", () => {
    const routePaths = flattenRoutePaths(flattenRouteEntries(routes))
    expect(routePaths).toContain("auth/device")
    expect(routePaths).toContain("policies/licenses")
    expect(routePaths).not.toContain("tv")
  })

  it("loads every Settings section as its own route module", () => {
    const settings = findRouteByFile("_site.settings.tsx")
    const children = settings?.children ?? []
    expect(children.length).toBeGreaterThan(1)

    // Independently loaded: one distinct file per section, none inherited
    // from the parent layout.
    const files = children.map((child) => child.file)
    expect(files.every(Boolean)).toBe(true)
    expect(new Set(files).size).toBe(files.length)
    expect(files).not.toContain(settings?.file)

    // The index is the only pathless child; every section has a path.
    expect(children.filter((child) => child.path === undefined)).toHaveLength(1)
  })

  it("groups guest-session validation under one shared layout", () => {
    const guestLayout = findRouteByFile("_auth.guest.tsx")
    const children = guestLayout?.children ?? []
    expect(children.length).toBeGreaterThan(1)

    const paths = children.map((child) => child.path)
    expect(paths.every((path) => path?.startsWith("auth/"))).toBe(true)
    const files = children.map((child) => child.file)
    expect(files.every(Boolean)).toBe(true)
    expect(new Set(files).size).toBe(files.length)
  })
})
