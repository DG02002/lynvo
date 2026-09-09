import { describe, expect, it } from "vitest"
import { shouldRevalidateSaveRoute } from "~/features/links/routes/save-route-shared"

const navigation = (
  current: string,
  next: string,
  overrides: Partial<Parameters<typeof shouldRevalidateSaveRoute>[0]> = {}
) =>
  shouldRevalidateSaveRoute({
    currentUrl: new URL(current, "https://lynvo.example"),
    nextUrl: new URL(next, "https://lynvo.example"),
    defaultShouldRevalidate: true,
    ...overrides,
  })

describe("save route revalidation", () => {
  it("reuses the snapshot when only the hybrid group changes", () => {
    expect(navigation("/save?group=one", "/save?group=two")).toBe(false)
    expect(navigation("/save", "/save?group=two")).toBe(false)
  })

  it("keeps revalidation for other search changes and mutations", () => {
    expect(navigation("/save?group=one", "/save?filter=unopened")).toBe(true)
    expect(navigation("/save", "/save?group=two", { formMethod: "POST" })).toBe(
      true
    )
  })

  it("preserves explicit same-location revalidation", () => {
    expect(navigation("/save", "/save")).toBe(true)
  })
})
