import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  GitHubMark,
  ScrapeDoMark,
  TelegramMark,
} from "~/components/brand-marks"

describe("brand marks", () => {
  it("keeps SVG definition ids unique when marks repeat on a page", () => {
    const { container } = render(
      <>
        <ScrapeDoMark />
        <ScrapeDoMark />
        <TelegramMark />
        <TelegramMark />
        <GitHubMark />
        <GitHubMark />
      </>
    )
    const ids = Array.from(container.querySelectorAll("[id]"), (element) =>
      element.getAttribute("id")
    )
    const localReferences = Array.from(
      container.querySelectorAll("[clip-path], [fill^='url(#']")
    )
      .flatMap((element) => [
        element.getAttribute("clip-path"),
        element.getAttribute("fill"),
      ])
      .flatMap((value) => Array.from(value?.matchAll(/url\(#([^)]+)\)/g) ?? []))
      .map((match) => match[1])

    expect(new Set(ids).size).toBe(ids.length)
    expect(localReferences).not.toHaveLength(0)
    expect(localReferences.every((id) => ids.includes(id))).toBe(true)
  })
})
