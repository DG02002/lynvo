import { describe, expect, it } from "vitest"

import routes from "~/routes"

const getRoutePaths = (routeConfig: typeof routes): string[] =>
  routeConfig.flatMap((routeEntry) => [
    ...(routeEntry.path === undefined ? [] : [routeEntry.path]),
    ...(routeEntry.children === undefined
      ? []
      : getRoutePaths(routeEntry.children)),
  ])

describe("production route table", () => {
  it("does not expose the test-only links route", () => {
    expect(getRoutePaths(routes)).not.toContain("ui-test-list")
  })

  it("exposes the public device-login and license routes", () => {
    const routePaths = getRoutePaths(routes)

    expect(routePaths).toContain("device")
    expect(routePaths).toContain("policies/licenses")
    expect(routePaths).not.toContain("tv")
  })
})
