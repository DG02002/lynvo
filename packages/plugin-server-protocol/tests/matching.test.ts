import { describe, expect, it } from "vitest"
import { matchPluginServerUrl } from "../src/index"

describe("Plugin Server URL matching", () => {
  it("treats regular expression metacharacters as literals", () => {
    expect(
      matchPluginServerUrl("https://source.example/media123", [
        {
          hosts: ["source.example"],
          pathPatterns: ["/media\\d+"],
        },
      ])
    ).toBe(false)
  })

  it("preserves single and double wildcard path semantics", () => {
    const matcher = {
      hosts: ["source.example"],
      pathPatterns: ["/media/**"],
    }

    expect(
      matchPluginServerUrl("https://source.example/media/a/b", [matcher])
    ).toBe(true)
    expect(
      matchPluginServerUrl("https://source.example/other", [matcher])
    ).toBe(false)
  })
})
