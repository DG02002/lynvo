import { GoogleDriveIcon } from "@hugeicons/core-free-icons"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PluginIcon, PluginServerAvatar } from "~/components/plugin-icon"

describe("PluginIcon", () => {
  it("renders explicitly provided Hugeicons", () => {
    const { container } = render(
      <PluginIcon icon={{ hugeIcon: GoogleDriveIcon }} className="size-8" />
    )

    expect(container.querySelector("svg")).not.toBeNull()
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

describe("PluginServerAvatar", () => {
  it("assigns the same icon and gradient to the same server", () => {
    const first = render(
      <PluginServerAvatar serverId="server-1" name="Example" />
    )
    const second = render(
      <PluginServerAvatar serverId="server-1" name="Example" />
    )
    const firstTile = first.container.querySelector(
      "[data-plugin-server-avatar]"
    )
    const secondTile = second.container.querySelector(
      "[data-plugin-server-avatar]"
    )
    expect(firstTile?.getAttribute("class")).toBe(
      secondTile?.getAttribute("class")
    )
    expect(firstTile).toHaveAttribute("role", "img")
    expect(firstTile).toHaveAttribute("aria-label", "Example")
  })

  it("assigns different icons across different servers", () => {
    const first = render(<PluginServerAvatar serverId="server-1" name="One" />)
    const second = render(<PluginServerAvatar serverId="server-2" name="Two" />)
    const firstIcon = first.container.querySelector(
      "[data-plugin-server-avatar] > svg"
    )
    const secondIcon = second.container.querySelector(
      "[data-plugin-server-avatar] > svg"
    )
    const iconsDiffer =
      firstIcon?.innerHTML !== secondIcon?.innerHTML ||
      first.container
        .querySelector("[data-plugin-server-avatar]")
        ?.getAttribute("class") !==
        second.container
          .querySelector("[data-plugin-server-avatar]")
          ?.getAttribute("class")
    expect(iconsDiffer).toBe(true)
  })
})
