import { afterEach, describe, expect, it, vi } from "vitest"
import { probeBhadooDomain } from "~/lib/plugins/bhadoo-domain-probe"

describe("Bhadoo domain probe", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("detects auth on the standard drive route when the root is public", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(probeBhadooDomain("index.example.com")).resolves.toBe(401)
    expect(fetchMock.mock.calls.map(([url]) => url.toString())).toEqual([
      "https://index.example.com/",
      "https://index.example.com/0:/",
    ])
  })

  it("probes the submitted drive path without replacing it with the root", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(
      probeBhadooDomain("https://index.example.com/0:/")
    ).resolves.toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
