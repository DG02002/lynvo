import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it("parses schemas without attempting string evaluation", async () => {
  vi.resetModules()

  const functionConstructor = vi.fn(() => {
    throw new Error("Zod attempted string evaluation")
  })
  vi.stubGlobal("Function", functionConstructor)

  await import("~/lib/configure-zod")
  const { z } = await import("zod")

  expect(z.object({ name: z.string() }).parse({ name: "Lynvo" })).toEqual({
    name: "Lynvo",
  })
  expect(functionConstructor).not.toHaveBeenCalled()
})
