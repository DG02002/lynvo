import type { ShouldRevalidateFunction } from "react-router"
import { describe, expect, it } from "vitest"

import { shouldRevalidateSaveRoute } from "~/features/links/routes/save-route-shared"

const createNavigation =
  (shouldRevalidate: ShouldRevalidateFunction) =>
  (
    current: string,
    next: string,
    overrides: Partial<Parameters<ShouldRevalidateFunction>[0]> = {}
  ) =>
    shouldRevalidate({
      currentUrl: new URL(current, "https://lynvo.example"),
      nextUrl: new URL(next, "https://lynvo.example"),
      defaultShouldRevalidate: true,
      ...overrides,
    })

const navigation = createNavigation(shouldRevalidateSaveRoute)

describe("save route revalidation", () => {
  it("reuses the snapshot when only the gallery group changes", () => {
    expect(navigation("/save?group=one", "/save?group=two")).toBe(false)
    expect(navigation("/save", "/save?group=two")).toBe(false)
  })

  it("reuses the snapshot between the library and saved folders", () => {
    expect(navigation("/save", "/save/folder/one")).toBe(false)
    expect(navigation("/save/folder/one", "/save")).toBe(false)
    expect(navigation("/save?group=one", "/save/folder/one?path=season")).toBe(
      false
    )
  })

  it("reuses the snapshot when navigating between saved folders", () => {
    expect(navigation("/save/folder/one", "/save/folder/two")).toBe(false)
    expect(
      navigation("/save/folder/one?group=movies", "/save/folder/two")
    ).toBe(false)
    expect(
      navigation(
        "/save/folder/one?path=season-one",
        "/save/folder/one?path=season-two"
      )
    ).toBe(false)
  })

  it("keeps revalidation for other search changes and mutations", () => {
    expect(navigation("/save?group=one", "/save?filter=unopened")).toBe(true)
    expect(navigation("/save", "/save?group=two", { formMethod: "POST" })).toBe(
      true
    )
    expect(
      navigation("/save/folder/one", "/save/folder/two", { formMethod: "POST" })
    ).toBe(true)
  })

  it("preserves explicit same-location revalidation", () => {
    expect(navigation("/save", "/save")).toBe(true)
    expect(navigation("/save/folder/one", "/save/folder/one")).toBe(true)
  })
})
