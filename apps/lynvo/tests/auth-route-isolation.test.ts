import { describe, expect, it } from "vitest"
import routes from "~/routes"

describe("Guest authentication route ownership", () => {
  it("keeps guest-session validation in a shared sibling layout", () => {
    const authLayout = routes.find((entry) => entry.file?.endsWith("_auth.tsx"))
    const guestLayout = authLayout?.children?.find((entry) =>
      entry.file?.endsWith("_auth.guest.tsx")
    )

    expect(guestLayout?.children?.map((entry) => entry.path)).toEqual([
      "auth/log-in",
      "auth/create-account",
      "auth/sign-in-with-another-device",
    ])
  })
})
