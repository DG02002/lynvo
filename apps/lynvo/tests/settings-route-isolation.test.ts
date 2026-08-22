import { describe, expect, it } from "vitest"
import routes from "~/routes"

describe("Settings route ownership", () => {
  it("defines independently loaded child routes for every Settings section", () => {
    const siteLayout = routes.find((entry) => entry.file?.endsWith("_site.tsx"))
    const settings = siteLayout?.children?.find(
      (entry) => entry.path === "settings"
    )

    expect(settings?.children?.map((entry) => entry.path)).toEqual([
      undefined,
      "general",
      "account",
      "security/:subview?",
      "plugins",
      "usage",
      "storage",
      "player",
    ])
    expect(settings?.children?.map((entry) => entry.file)).toEqual([
      "features/site/routes/_site.settings._index.ts",
      "features/site/routes/_site.settings.general.tsx",
      "features/site/routes/_site.settings.account.tsx",
      "features/site/routes/_site.settings.security.tsx",
      "features/site/routes/_site.settings.plugins.tsx",
      "features/site/routes/_site.settings.usage.tsx",
      "features/site/routes/_site.settings.storage.tsx",
      "features/site/routes/_site.settings.player.tsx",
    ])
  })
})
