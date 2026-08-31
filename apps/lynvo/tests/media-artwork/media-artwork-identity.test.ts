import { describe, expect, it } from "vitest"
import {
  getMediaArtworkRequest,
  getMediaDisplayTitle,
  hasEpisodeMarker,
  isEpisodeOnlyListing,
} from "~/features/links/media-artwork/media-artwork-identity"

describe("Episode marker detection", () => {
  it("detects episode and episode-range labels", () => {
    expect(hasEpisodeMarker("Warden.S01E01.2160p.REMUX.mkv")).toBe(true)
    expect(hasEpisodeMarker("Show.S01E02-E04.mkv")).toBe(true)
    expect(hasEpisodeMarker("Episode 02.mkv", "Slow Sample S03")).toBe(true)
  })

  it("rejects movies, folders, and junk labels", () => {
    expect(hasEpisodeMarker("The.Sample.1999.1080p.mkv")).toBe(false)
    expect(hasEpisodeMarker("Season 2", "Slow Sample")).toBe(false)
    expect(hasEpisodeMarker("2160p HDR BluRay REMUX H.265")).toBe(false)
  })
})

describe("Media artwork identity", () => {
  it("maps movie filenames to movie artwork requests", () => {
    expect(getMediaArtworkRequest("The.Sample.1999.1080p.BluRay.mkv")).toEqual({
      mediaKind: "movie",
      title: "The Sample",
      year: 1999,
    })
  })

  it("maps episode filenames to episode artwork requests", () => {
    expect(
      getMediaArtworkRequest("Slow.Sample.S03E04.720p.WEB.x264.mkv")
    ).toEqual({
      mediaKind: "tv",
      title: "Slow Sample",
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
    expect(getMediaArtworkRequest("Season 2", "Slow Sample")).toEqual({
      mediaKind: "tv",
      title: "Slow Sample",
      seasonNumber: 2,
    })
  })

  it("skips artwork for container labels that only look like weak movies", () => {
    expect(
      getMediaArtworkRequest("Tag-HDR 2160p WEB-DL H.265", undefined, {
        isContainer: true,
      })
    ).toBeUndefined()
    expect(
      getMediaArtworkRequest("Feature.2021.1080p.WEB-DL.mkv", undefined, {
        isContainer: true,
      })
    ).toEqual({
      mediaKind: "movie",
      title: "Feature",
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
    expect(getMediaDisplayTitle("The.Sample.1999.1080p.BluRay.mkv")).toBe(
      "The Sample (1999)"
    )
    expect(getMediaDisplayTitle("Sample.Man.720p.WEB-DL.mkv")).toBe(
      "Sample Man"
    )
  })

  it("cleans episode filenames into title and marker", () => {
    expect(getMediaDisplayTitle("Sample.Things.S01E02.720p.mkv")).toBe(
      "Sample Things S01E02"
    )
    expect(getMediaDisplayTitle("Show.S01E02-E04.mkv")).toBe("Show S01E02-E04")
  })

  it("combines show context with season folders", () => {
    expect(getMediaDisplayTitle("Season 4", "Warden S04")).toBe(
      "Warden Season 4"
    )
  })

  it("returns undefined when no confident title exists", () => {
    expect(getMediaDisplayTitle("Tag-HDR 2160p WEB-DL H.265")).toBeUndefined()
    expect(getMediaDisplayTitle("file.mkv")).toBeUndefined()
  })
})

describe("isEpisodeOnlyListing", () => {
  it("accepts a listing of episodes", () => {
    expect(
      isEpisodeOnlyListing([
        "Sample.Things.S01E01.720p.mkv",
        "Sample.Things.S01E02.720p.mkv",
      ])
    ).toBe(true)
  })

  it("ignores sidecar files like subtitles and artwork", () => {
    expect(
      isEpisodeOnlyListing([
        "Sample.Things.S01E01.720p.mkv",
        "Sample.Things.S01E01.720p.srt",
        "poster.jpg",
        "show.nfo",
      ])
    ).toBe(true)
  })

  it("rejects listings containing other media files or folders", () => {
    expect(
      isEpisodeOnlyListing([
        "Sample.Things.S01E01.720p.mkv",
        "Trailer.720p.WEB-DL.mkv",
      ])
    ).toBe(false)
    expect(
      isEpisodeOnlyListing(["Sample.Things.S01E01.720p.mkv", "Extras"])
    ).toBe(false)
  })

  it("rejects listings with no media at all", () => {
    expect(isEpisodeOnlyListing(["show.nfo", "poster.jpg"])).toBe(false)
    expect(isEpisodeOnlyListing([])).toBe(false)
  })
})
