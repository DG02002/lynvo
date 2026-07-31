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
  it("does not expose the test-only Recent Links route", () => {
    expect(getRoutePaths(routes)).not.toContain("ui-test-list")
  })
})
