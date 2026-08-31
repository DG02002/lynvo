import { describe, expect, it } from "vitest"
import { parseMediaFilename } from "~/features/links/media-artwork/media-filename-parser"

describe("parseMediaFilename", () => {
  it("classifies representative movie filenames", () => {
    const cases = [
      {
        filename:
          "Feature (2026) 2160p 10bit HDR10+ DV Store WEB-DL HEVC...mkv",
        title: "Feature",
        year: 2026,
      },
      {
        filename: "Feature-6.2026.1080p.HEVC.HDTC...mkv",
        title: "Feature 6",
        year: 2026,
      },
      {
        filename: "Alpha Runner (1982) Final Cut V2...mkv",
        title: "Alpha Runner",
        year: 1982,
      },
      {
        filename: "Metro.Love.Story.2026.720p...mkv",
        title: "Metro Love Story",
        year: 2026,
      },
      {
        filename: "Alpha & Beta (2024) 1080p...mkv",
        title: "Alpha & Beta",
        year: 2024,
      },
      {
        filename: "Hero - The Dark World (2013) 4K...mkv",
        title: "Hero - The Dark World",
        year: 2013,
      },
      {
        filename: "When Sample Was There 2014 (BD Remux...)",
        title: "When Sample Was There",
        year: 2014,
      },
    ]

    for (const testCase of cases) {
      const candidate = parseMediaFilename(testCase.filename)

      expect(candidate).toMatchObject({
        kind: "movie",
        title: testCase.title,
        year: testCase.year,
      })
    }
  })

  it("classifies representative episode and range filenames", () => {
    expect(
      parseMediaFilename("Sample.The.Series.S04E01.An.Episode.Name...mkv")
    ).toMatchObject({
      kind: "episode",
      title: "Sample The Series",
      seasonNumber: 4,
      episodeNumber: 1,
    })

    expect(parseMediaFilename("High School Sample - S01E01")).toMatchObject({
      kind: "episode",
      title: "High School Sample",
      seasonNumber: 1,
      episodeNumber: 1,
    })

    expect(
      parseMediaFilename("Sample Psycho 100 III (2022) S03E01...mkv")
    ).toMatchObject({
      kind: "episode",
      title: "Sample Psycho 100 III",
      year: 2022,
      seasonNumber: 3,
      episodeNumber: 1,
    })

    expect(
      parseMediaFilename("Sample Shippuden (2007) S06[E129-143]...")
    ).toMatchObject({
      kind: "episode-range",
      title: "Sample Shippuden",
      year: 2007,
      seasonNumber: 6,
      episodeNumber: 129,
      episodeEnd: 143,
    })
  })

  it("recognizes season-only names and folder context", () => {
    expect(parseMediaFilename("Sample no Ko Season 1 BluRay...")).toMatchObject(
      {
        kind: "season",
        title: "Sample no Ko",
        seasonNumber: 1,
      }
    )

    expect(
      parseMediaFilename("[SampleGroup] Sample Show S1 - BD...")
    ).toMatchObject({
      kind: "season",
      title: "Sample Show",
      seasonNumber: 1,
    })

    const folderCandidate = parseMediaFilename(
      "Sample_Adventures_of_Show_2020_S04_720p..."
    )
    expect(folderCandidate).toMatchObject({
      kind: "season",
      title: "Sample Adventures of Show",
      year: 2020,
      seasonNumber: 4,
    })

    expect(
      parseMediaFilename("Episode 02.mkv", "Sample Adventures of Show S04")
    ).toMatchObject({
      kind: "episode",
      title: "Sample Adventures of Show",
      seasonNumber: 4,
      episodeNumber: 2,
    })

    expect(
      parseMediaFilename(
        "Sample Adventures of Show S04E02...mkv",
        "Sample Adventures of Show S04"
      )
    ).toMatchObject({
      kind: "episode",
      title: "Sample Adventures of Show",
      seasonNumber: 4,
      episodeNumber: 2,
    })
  })

  it("supports marker separators and case variants", () => {
    expect(parseMediaFilename("Show Name s04 e01.mkv")).toMatchObject({
      kind: "episode",
      seasonNumber: 4,
      episodeNumber: 1,
    })
    expect(parseMediaFilename("Show Name S04_E01.mkv")).toMatchObject({
      kind: "episode",
      seasonNumber: 4,
      episodeNumber: 1,
    })
    expect(parseMediaFilename("Show Name season 4.mkv")).toMatchObject({
      kind: "season",
      seasonNumber: 4,
    })
    expect(parseMediaFilename("Show Name S4.mkv")).toMatchObject({
      kind: "season",
      seasonNumber: 4,
    })
  })

  it("does not infer episodes from technical or release numbers", () => {
    const technicalCandidate = parseMediaFilename(
      "Show Name 2160p 10bit HDR10+ WEB-DL HEVC 7.1.mkv"
    )
    expect(technicalCandidate.kind).not.toBe("episode")
    expect(technicalCandidate.kind).not.toBe("episode-range")
    expect(technicalCandidate.episodeNumber).toBeUndefined()
    expect(technicalCandidate.seasonNumber).toBeUndefined()

    const releaseCandidate = parseMediaFilename(
      "[Release129] Show Name 1080p 10bit.mkv"
    )
    expect(releaseCandidate.kind).not.toBe("episode")
    expect(releaseCandidate.episodeNumber).toBeUndefined()
  })

  it("returns ambiguous candidates for malformed or repeated markers", () => {
    expect(parseMediaFilename("Show Name S01E.mkv")).toMatchObject({
      kind: "ambiguous",
      rawText: "Show Name S01E.mkv",
    })
    expect(parseMediaFilename("Show Name SxxEyy.mkv")).toMatchObject({
      kind: "ambiguous",
    })
    expect(parseMediaFilename("Show Name S01E01 S01E02.mkv")).toMatchObject({
      kind: "ambiguous",
    })
  })

  it("returns unmatched candidates when there is no useful title signal", () => {
    expect(parseMediaFilename("")).toMatchObject({
      kind: "unknown",
      rawText: "",
    })
    expect(parseMediaFilename("video.mkv")).toMatchObject({
      kind: "unknown",
      rawText: "video.mkv",
    })
    expect(parseMediaFilename("[Group] 1080p.mkv")).toMatchObject({
      kind: "unknown",
    })
  })

  // Golden fixture: the eight real Stranger Things S05 filenames. E04's
  // "Sorcerer" once matched the letter-shaped malformed-marker pattern and
  // poisoned the whole listing.
  it("keeps episode titles containing S-word-E-word spellings parsable", () => {
    const realLabels = [
      "Stranger.Things.S05E01.Chapter.One.The.Crawl.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
      "Stranger.Things.S05E02.Chapter.Two.The.Vanishing.of.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
      "Stranger.Things.S05E03.Chapter.Three.The.Turnbow.Trap.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
      "Stranger.Things.S05E04.Chapter.Four.Sorcerer.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
      "Stranger.Things.S05E05.Chapter.Five.Shock.Jock.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
      "Stranger.Things.S05E06.Chapter.Six.Escape.from.Camazotz.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
      "Stranger.Things.S05E07.Chapter.Seven.The.Bridge.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
      "Stranger.Things.S05E08.Chapter.Eight.The.Rightside.Up.1080p.NF.WEB-DL.Multi.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
    ]
    for (const label of realLabels) {
      expect(parseMediaFilename(label)).toMatchObject({
        kind: "episode",
        seasonNumber: 5,
      })
    }
  })

  it("still flags uppercase letter-shaped placeholder markers as ambiguous", () => {
    expect(parseMediaFilename("Show.S01.SORCERER.WEB-DL.mkv").kind).toBe(
      "ambiguous"
    )
    expect(parseMediaFilename("Show.S01E.ABC.WEB-DL.mkv").kind).toBe(
      "ambiguous"
    )
  })
})
