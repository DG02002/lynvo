import { render } from "@testing-library/react"
import { GoogleDriveIcon } from "@hugeicons/core-free-icons"
import { describe, expect, it } from "vitest"
import { PluginIcon } from "~/components/plugin-icon"

describe("PluginIcon", () => {
  it("renders explicitly provided Hugeicons", () => {
    const { container } = render(
      <PluginIcon icon={{ hugeIcon: GoogleDriveIcon }} className="size-8" />
    )

    expect(container.querySelector("svg")).not.toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  it("renders the Plugin Server fallback when a manifest has no icon", () => {
    const { container } = render(
      <PluginIcon fallback="plugin-server" className="size-8" />
    )

    expect(
      container.querySelector('[data-icon-fallback="plugin-server"]')
    ).not.toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  it("renders the source fallback when source metadata has no icon", () => {
    const { container } = render(<PluginIcon className="size-8" />)

    expect(
      container.querySelector('[data-icon-fallback="source"]')
    ).not.toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  it("renders URL icons from Custom Plugin Server manifests", () => {
    const { container } = render(
      <PluginIcon
        icon={{ url: "https://plugin-server.example/icon.webp" }}
        className="size-8"
      />
    )

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://plugin-server.example/icon.webp"
    )
  })
})
