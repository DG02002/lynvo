import { describe, expect, it } from "vitest"

import { paginateUpstream } from "../src/sources/pagination"

describe("paginateUpstream", () => {
  it("collects nodes and carries an upstream page index", async () => {
    const calls: Array<{ token: string; pageIndex: number }> = []
    const result = await paginateUpstream(
      async (token, pageIndex) => {
        calls.push({ token, pageIndex })
        return token
          ? { value: ["second"] }
          : { value: ["first"], nextToken: "continuation", nextPageIndex: 4 }
      },
      (page) => page,
      { sourceName: "Test Index" }
    )

    expect(result).toEqual(["first", "second"])
    expect(calls).toEqual([
      { token: "", pageIndex: 0 },
      { token: "continuation", pageIndex: 4 },
    ])
  })

  it("rejects repeated continuation tokens", async () => {
    await expect(
      paginateUpstream(
        async () => ({ value: [], nextToken: "repeated" }),
        (page) => page,
        { sourceName: "Test Index" }
      )
    ).rejects.toThrow("Test Index repeated a continuation token.")
  })

  it("rejects a pagination deadline before fetching another page", async () => {
    const fetchPage = async () => ({ value: [] })

    await expect(
      paginateUpstream(fetchPage, (page) => page, {
        sourceName: "Test Index",
        startedAtMs: 0,
        now: () => 45_000,
      })
    ).rejects.toThrow("Test Index pagination exceeded its limit.")
  })

  it("rejects a page that exceeds the node limit", async () => {
    await expect(
      paginateUpstream(
        async () => ({ value: Array.from({ length: 5_001 }, (_, i) => i) }),
        (page) => page,
        { sourceName: "Test Index" }
      )
    ).rejects.toThrow("Test Index returned too many nodes.")
  })
})
