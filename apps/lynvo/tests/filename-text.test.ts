import { describe, expect, it } from "vitest"
import { getFilenameBreakSegments } from "~/components/filename-text"

describe("getFilenameBreakSegments", () => {
  it("adds useful breaks throughout dot-separated media filenames", () => {
    const filename =
      "SERIES.-Sample.episode.title.S03E01.Another.Sample.Title.1080p.PROVIDER.WEB-DL.English.DDP2.0-Japanese.DDP2.0.H.264-ReleaseGroup.Example.mkv"
    const segments = getFilenameBreakSegments(filename)

    expect(segments.join("")).toBe(filename)
    expect(segments[0]).toBe("SERIES.-Sample.")
    expect(segments.at(-1)).toBe("Example.mkv")
  })

  it("keeps numeric and codec expressions together", () => {
    const filename =
      "Sample.Series.S01.2160p.PROVIDER.WEB-DL.MULTi.DDP5.1.Atmos.DV.HDR.H.265-ReleaseGroup.Example.zip"
    const segments = getFilenameBreakSegments(filename)

    expect(segments.join("")).toBe(filename)
    expect(segments).toContain("DDP5.1.")
    expect(segments.at(-1)).toBe("Example.zip")
  })

  it("adds breaks after underscores without changing the filename", () => {
    const filename =
      "Sample.Feature.Title.[2026].1080p.DS4K.10bit.{60FPS}.WEBRIP.x265.Language.DDP.5.1.ESub.[-=Release_Group=-]"
    const segments = getFilenameBreakSegments(filename)

    expect(segments.join("")).toBe(filename)
    expect(segments.some((segment) => segment.endsWith("Release_"))).toBe(true)
  })
})
