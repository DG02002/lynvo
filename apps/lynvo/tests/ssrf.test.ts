import { describe, expect, it, vi } from "vitest"
import {
  createOutboundHttpTransport,
  OutboundHttpError,
} from "~/lib/outbound-http"

describe("outbound HTTP safety boundary", () => {
  it.each([
    "http://127.0.0.1/resource",
    "http://2130706433/resource",
    "http://0x7f000001/resource",
    "http://0177.0.0.1/resource",
    "http://[::1]/resource",
    "http://[::ffff:127.0.0.1]/resource",
    "http://169.254.169.254/latest/meta-data",
    "https://user:password@example.com/resource",
  ])("rejects a non-public destination: %s", async (url) => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const transport = createOutboundHttpTransport({ fetch })

    await expect(transport.fetch(url)).rejects.toBeInstanceOf(OutboundHttpError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("validates every redirect before following it", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/private" },
      })
    )
    const transport = createOutboundHttpTransport({ fetch })

    await expect(
      transport.fetch("https://public.example/start")
    ).rejects.toMatchObject({ code: "UNSAFE_DESTINATION" })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it("never forwards protected credentials across origins", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(null, {
        status: 307,
        headers: { Location: "https://other.example/final" },
      })
    )
    const transport = createOutboundHttpTransport({ fetch })

    await expect(
      transport.fetch("https://plugin.example/usage", {
        headers: { Authorization: "Bearer secret" },
        protectedOrigin: "https://plugin.example",
      })
    ).rejects.toMatchObject({ code: "CROSS_ORIGIN_REDIRECT" })
    expect(fetch).toHaveBeenCalledOnce()
  })
})
