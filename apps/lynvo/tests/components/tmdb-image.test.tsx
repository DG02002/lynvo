import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { TmdbImage } from "~/features/links/components/tmdb-image"

const stashImagePrototypeDescriptors = () => {
  const completeDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "complete"
  )
  const naturalWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "naturalWidth"
  )
  return { completeDescriptor, naturalWidthDescriptor }
}

const restoreImagePrototypeDescriptors = (
  descriptors: ReturnType<typeof stashImagePrototypeDescriptors>
) => {
  const { completeDescriptor, naturalWidthDescriptor } = descriptors
  if (completeDescriptor) {
    Object.defineProperty(
      HTMLImageElement.prototype,
      "complete",
      completeDescriptor
    )
  }
  if (naturalWidthDescriptor) {
    Object.defineProperty(
      HTMLImageElement.prototype,
      "naturalWidth",
      naturalWidthDescriptor
    )
  }
}

const simulateCachedImages = () => {
  Object.defineProperty(HTMLImageElement.prototype, "complete", {
    get: () => true,
    configurable: true,
  })
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
    get: () => 500,
    configurable: true,
  })
}

describe("TmdbImage", () => {
  const descriptors = stashImagePrototypeDescriptors()

  afterEach(() => {
    restoreImagePrototypeDescriptors(descriptors)
  })

  it("renders nothing without a path", () => {
    const { container } = render(
      <TmdbImage path={undefined} variant="card" alt="Poster" />
    )

    expect(container.querySelectorAll("img")).toHaveLength(0)
  })

  it("keeps the full image hidden while it is still loading", () => {
    render(<TmdbImage path="/poster.jpg" variant="card" alt="Poster" />)

    const posterImage = screen.getByAltText("Poster")
    expect(posterImage).toHaveClass("opacity-0")
  })

  it("reveals images that finished loading before hydration", () => {
    simulateCachedImages()
    render(<TmdbImage path="/poster.jpg" variant="card" alt="Poster" />)

    const posterImage = screen.getByAltText("Poster")
    expect(posterImage).toHaveClass("opacity-100")
  })

  it("uses the full URL directly for remote paths without a preview layer", () => {
    render(
      <TmdbImage
        path="https://example.com/poster.jpg"
        variant="card"
        alt="Poster"
      />
    )

    const posterImage = screen.getByAltText("Poster")
    expect(posterImage).toHaveAttribute("src", "https://example.com/poster.jpg")
    expect(screen.queryByRole("img", { name: "" })).not.toBeInTheDocument()
  })

  it("uses the wide-card source size for landscape episode artwork", () => {
    render(
      <TmdbImage path="/still.jpg" variant="wide-card" alt="Episode still" />
    )

    expect(screen.getByAltText("Episode still")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w780/still.jpg"
    )
  })

  it("offers poster and still source sets for resolution-appropriate downloads", () => {
    render(
      <TmdbImage
        path="/poster.jpg"
        variant="card"
        alt="Poster"
        imageType="poster"
        sizes="45vw"
      />
    )
    render(
      <TmdbImage
        path="/still.jpg"
        variant="wide-card"
        alt="Episode still"
        imageType="still"
        sizes="100vw"
      />
    )

    expect(screen.getByAltText("Poster")).toHaveAttribute(
      "srcSet",
      "https://image.tmdb.org/t/p/w342/poster.jpg 342w, https://image.tmdb.org/t/p/w500/poster.jpg 500w, https://image.tmdb.org/t/p/w780/poster.jpg 780w"
    )
    expect(screen.getByAltText("Poster")).toHaveAttribute("sizes", "45vw")
    expect(screen.getByAltText("Episode still")).toHaveAttribute(
      "srcSet",
      "https://image.tmdb.org/t/p/w300/still.jpg 300w, https://image.tmdb.org/t/p/w780/still.jpg 780w, https://image.tmdb.org/t/p/w1280/still.jpg 1280w"
    )
  })
})
