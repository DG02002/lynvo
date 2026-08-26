import { describe, expect, it } from "vitest"
import {
  getMediaArtworkRequest,
  getMediaDisplayTitle,
  hasEpisodeMarker,
} from "~/features/links/media-artwork/media-artwork-identity"

describe("Episode marker detection", () => {
  it("detects episode and episode-range labels", () => {
    expect(hasEpisodeMarker("Reacher.S01E01.2160p.REMUX.mkv")).toBe(true)
    expect(hasEpisodeMarker("Show.S01E02-E04.mkv")).toBe(true)
    expect(hasEpisodeMarker("Episode 02.mkv", "Slow Horses S03")).toBe(true)
  })

  it("rejects movies, folders, and junk labels", () => {
    expect(hasEpisodeMarker("The.Matrix.1999.1080p.mkv")).toBe(false)
    expect(hasEpisodeMarker("Season 2", "Slow Horses")).toBe(false)
    expect(hasEpisodeMarker("2160p HDR BluRay REMUX H.265")).toBe(false)
  })
})

describe("Media artwork identity", () => {
  it("maps movie filenames to movie artwork requests", () => {
    expect(getMediaArtworkRequest("The.Matrix.1999.1080p.BluRay.mkv")).toEqual({
      mediaKind: "movie",
      title: "The Matrix",
      year: 1999,
    })
  })

  it("maps episode filenames to episode artwork requests", () => {
    expect(
      getMediaArtworkRequest("Slow.Horses.S03E04.720p.WEB.x264.mkv")
    ).toEqual({
      mediaKind: "tv",
      title: "Slow Horses",
      seasonNumber: 3,
      episodeNumber: 4,
    })
  })

  it("maps episode ranges to the first episode", () => {
    expect(getMediaArtworkRequest("Show.S01E02-E04.mkv")).toEqual({
      mediaKind: "tv",
      title: "Show",
      seasonNumber: 1,
      episodeNumber: 2,
    })
  })

  it("maps season folders to season artwork requests", () => {
    expect(getMediaArtworkRequest("Season 2", "Slow Horses")).toEqual({
      mediaKind: "tv",
      title: "Slow Horses",
      seasonNumber: 2,
    })
  })

  it("skips artwork for container labels that only look like weak movies", () => {
    expect(
      getMediaArtworkRequest("Dovi-HDR 2160p WEB-DL H.265", undefined, {
        isContainer: true,
      })
    ).toBeUndefined()
    expect(
      getMediaArtworkRequest("Dune.2021.1080p.WEB-DL.mkv", undefined, {
        isContainer: true,
      })
    ).toEqual({
      mediaKind: "movie",
      title: "Dune",
      year: 2021,
    })
  })

  it("treats plain phrases without markers as movie lookups", () => {
    expect(getMediaArtworkRequest("Watch online free now")).toEqual({
      mediaKind: "movie",
      title: "Watch online free now",
    })
  })

  it("returns undefined for labels without a usable title", () => {
    expect(getMediaArtworkRequest("file.mkv")).toBeUndefined()
    expect(getMediaArtworkRequest("")).toBeUndefined()
  })
})

describe("Media display title", () => {
  it("cleans movie filenames and keeps the year", () => {
    expect(getMediaDisplayTitle("The.Matrix.1999.1080p.BluRay.mkv")).toBe(
      "The Matrix (1999)"
    )
    expect(getMediaDisplayTitle("Iron.Man.720p.WEB-DL.mkv")).toBe("Iron Man")
  })

  it("cleans episode filenames into title and marker", () => {
    expect(getMediaDisplayTitle("Stranger.Things.S01E02.720p.mkv")).toBe(
      "Stranger Things S01E02"
    )
    expect(getMediaDisplayTitle("Show.S01E02-E04.mkv")).toBe("Show S01E02-E04")
  })

  it("combines show context with season folders", () => {
    expect(getMediaDisplayTitle("Season 4", "Reacher S04")).toBe(
      "Reacher Season 4"
    )
  })

  it("returns undefined when no confident title exists", () => {
    expect(getMediaDisplayTitle("Dovi-HDR 2160p WEB-DL H.265")).toBeUndefined()
    expect(getMediaDisplayTitle("file.mkv")).toBeUndefined()
  })
})
