import { describe, expect, it, vi } from "vitest"
import { createMemoryRouter } from "react-router"
import { shouldRevalidateRoot } from "~/root/root-revalidation"

const navigation = (
  current: string,
  next: string,
  overrides: Partial<Parameters<typeof shouldRevalidateRoot>[0]> = {}
) =>
  shouldRevalidateRoot({
    currentUrl: new URL(current, "https://lynvo.example"),
    nextUrl: new URL(next, "https://lynvo.example"),
    defaultShouldRevalidate: true,
    ...overrides,
  })

describe("root loader revalidation", () => {
  it.each([
    ["/save", "/about"],
    ["/settings/general", "/settings/player"],
    ["/auth/log-in", "/auth/create-account"],
    ["/docs/getting-started", "/docs/plugins"],
  ])(
    "reuses root-owned data for ordinary navigation from %s to %s",
    (from, to) => {
      expect(navigation(from, to)).toBe(false)
    }
  )

  it.each([
    ["POST", "/api/auth/sign-in"],
    ["DELETE", "/api/auth/session"],
    ["DELETE", "/api/settings/security/account"],
    ["PATCH", "/api/settings/security/password"],
    ["DELETE", "/api/settings/security/sessions/session-one"],
  ])(
    "revalidates after the identity-changing %s %s operation",
    (formMethod, formAction) => {
      expect(
        navigation("/settings/security", "/settings/security", {
          formMethod,
          formAction,
        })
      ).toBe(true)
    }
  )

  it("honors an explicit same-location revalidation request", () => {
    expect(navigation("/save", "/save")).toBe(true)
  })

  it("does not call the root loader again from Save to About", async () => {
    const rootLoader = vi.fn(async () => ({ user: null }))
    const router = createMemoryRouter(
      [
        {
          id: "root",
          path: "/",
          loader: rootLoader,
          shouldRevalidate: shouldRevalidateRoot,
          children: [
            { path: "save", loader: async () => null },
            { path: "about", loader: async () => null },
          ],
        },
      ],
      { initialEntries: ["/save"] }
    )
    if (!router.state.initialized) {
      await new Promise<void>((resolve) => {
        const unsubscribe = router.subscribe((state) => {
          if (state.initialized && state.navigation.state === "idle") {
            unsubscribe()
            resolve()
          }
        })
      })
    }
    rootLoader.mockClear()

    await router.navigate("/about")

    expect(rootLoader).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe("/about")
  })
})
