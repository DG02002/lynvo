import { render } from "@testing-library/react"
import { GoogleDriveIcon } from "@hugeicons/core-free-icons"
import { describe, expect, it } from "vitest"
import { PluginIcon } from "~/components/plugin-icon"

describe("PluginIcon", () => {
  it("renders Hugeicons for built-in plugins", () => {
    const { container } = render(
      <PluginIcon icon={{ hugeIcon: GoogleDriveIcon }} className="size-8" />
    )

    expect(container.querySelector("svg")).not.toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  it("renders URL icons from PLNK and external manifests", () => {
    const { container } = render(
      <PluginIcon
        icon={{ url: "https://extractor.example/icon.webp" }}
        className="size-8"
      />
    )

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://extractor.example/icon.webp"
    )
  })
})
