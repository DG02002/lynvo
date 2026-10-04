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

  it("drops an AKA alternate-title segment before identifying the title", () => {
    expect(
      parseMediaFilename(
        "The Desert Child AKA Lenfant du désert (2026) 2160p.WEB-DL.mkv"
      )
    ).toMatchObject({
      kind: "movie",
      title: "The Desert Child",
      year: 2026,
    })

    expect(
      parseMediaFilename("Metro.Love.Story.AKA.Histoire.de.Metro.2026.720p.mkv")
    ).toMatchObject({
      kind: "movie",
      title: "Metro Love Story",
      year: 2026,
    })

    expect(
      parseMediaFilename("Feature AKA Alternate Title With No Tail.mkv")
    ).toMatchObject({
      kind: "movie",
      title: "Feature",
      year: undefined,
    })
  })

  it("keeps a leading AKA as the title itself", () => {
    expect(parseMediaFilename("AKA 2023 1080p.mkv")).toMatchObject({
      kind: "movie",
      title: "AKA",
      year: 2023,
    })
  })

  it("keeps lowercase aka inside a title untouched", () => {
    expect(parseMediaFilename("Te aka o te mirai (2020).mkv")).toMatchObject({
      kind: "movie",
      title: "Te aka o te mirai",
      year: 2020,
    })
  })

  // Golden corpus: the real-world sample filenames from the artwork bug
  // reports, pinned so regressions in one name surface immediately.
  it("classifies the reported real-world filename corpus", () => {
    const cases = [
      {
        filename: "MobLand.2025.S02E03.1080p.DSNP.WEB-DL.mkv",
        kind: "episode",
        title: "MobLand",
        year: 2025,
        seasonNumber: 2,
        episodeNumber: 3,
      },
      {
        filename: "MobLand (2026) S02E03 1080p.mkv",
        kind: "episode",
        title: "MobLand",
        year: 2026,
        seasonNumber: 2,
        episodeNumber: 3,
      },
      {
        filename:
          "The.Piano.in.a.Factory.AKA.Gang.de.qin.2011.1080p.WEB-DL.mkv",
        kind: "movie",
        title: "The Piano in a Factory",
        year: 2011,
      },
      {
        filename: "Wet Dreams 2 AKA 몽정기 2 2005 1080p.mkv",
        kind: "movie",
        title: "Wet Dreams 2",
        year: 2005,
      },
      {
        filename: "1917 2019 PROPER 2160p.UHD.BluRay.mkv",
        kind: "movie",
        title: "1917",
        year: 2019,
      },
      {
        filename: "Drishyam-3 2026 1080p.WEB-DL.mkv",
        kind: "movie",
        title: "Drishyam 3",
        year: 2026,
      },
      {
        filename: "Inspector.Avinash.S02.COMBINED.1080p.AMZN.WEB-DL.mkv",
        kind: "season",
        title: "Inspector Avinash",
        seasonNumber: 2,
      },
      {
        filename: "Frozen.2010.1080p.BluRay.mkv",
        kind: "movie",
        title: "Frozen",
        year: 2010,
      },
      {
        filename: "The.Avengers.1080p.BluRay.mkv",
        kind: "movie",
        title: "The Avengers",
        year: undefined,
      },
      {
        filename: "KonoSuba Gods Blessing S00E04 OVA 1080p.CR.WEB-DL.mkv",
        kind: "episode",
        title: "KonoSuba Gods Blessing",
        seasonNumber: 0,
        episodeNumber: 4,
      },
      {
        filename: "KonoSuba Gods Blessing S00E06 v2 Red-DDP 1080p.mkv",
        kind: "episode",
        title: "KonoSuba Gods Blessing",
        seasonNumber: 0,
        episodeNumber: 6,
      },
      {
        filename:
          "Tokyo Revengers AKA Tôkyô Ribenjâzu S03 1080p DSNP WEB-DL.mkv",
        kind: "season",
        title: "Tokyo Revengers",
        seasonNumber: 3,
      },
    ]

    for (const { filename, ...expected } of cases) {
      expect(parseMediaFilename(filename)).toMatchObject(expected)
    }
  })

  it("strips uppercase edition tokens from no-year titles but keeps mixed-case title words", () => {
    expect(parseMediaFilename("Feature.PROPER.1080p.WEB-DL.mkv")).toMatchObject(
      {
        kind: "movie",
        title: "Feature",
        year: undefined,
      }
    )
    expect(
      parseMediaFilename("Show.Name.S01E02.REPACK.1080p.mkv")
    ).toMatchObject({
      kind: "episode",
      seasonNumber: 1,
      episodeNumber: 2,
    })
    expect(
      parseMediaFilename("Uncut.Gems.2019.1080p.BluRay.mkv")
    ).toMatchObject({
      kind: "movie",
      title: "Uncut Gems",
      year: 2019,
    })
  })

  it("keeps mixed-case release aliases in titles and strips uppercase aliases without a year", () => {
    expect(
      parseMediaFilename("Multi.Storey.2020.1080p.WEB-DL.mkv")
    ).toMatchObject({
      kind: "movie",
      title: "Multi Storey",
      year: 2020,
    })
    expect(
      parseMediaFilename("Hulu.House.2024.1080p.WEB-DL.mkv")
    ).toMatchObject({
      kind: "movie",
      title: "Hulu House",
      year: 2024,
    })
    expect(parseMediaFilename("The Show MULTI 1080p.mkv")).toMatchObject({
      kind: "movie",
      title: "The Show",
      year: undefined,
    })
  })
})
