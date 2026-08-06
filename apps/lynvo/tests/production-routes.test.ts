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
  it("exposes the public device-login and license routes", () => {
    const routePaths = getRoutePaths(routes)

    expect(routePaths).toContain("device")
    expect(routePaths).toContain("policies/licenses")
    expect(routePaths).not.toContain("tv")
  })
})
