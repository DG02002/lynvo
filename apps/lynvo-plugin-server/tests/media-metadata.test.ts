import { describe, expect, it } from "vitest"

import {
  getLastPathSegment,
  getResponseFileSize,
  parseContentDispositionFilename,
} from "../src/sources/media-metadata"

describe("Content-Disposition metadata", () => {
  it("prefers an extended UTF-8 filename and decodes its language-tagged value", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=\"fallback.mp4\"; filename*=UTF-8'en'%E2%9C%93%20clip.mp4"
      )
    ).toBe("✓ clip.mp4")
  })

  it("parses quoted filenames containing semicolons and escaped quotes", () => {
    expect(
      parseContentDispositionFilename(
        'attachment; filename="The; \\"final\\" cut.mp4"'
      )
    ).toBe('The; "final" cut.mp4')
  })

  it("parses unquoted filename parameters", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=unquoted%20clip.mp4"
      )
    ).toBe("unquoted clip.mp4")
  })
})

describe("response file metadata", () => {
  it("uses the total from Content-Range for partial responses", () => {
    expect(
      getResponseFileSize(
        206,
        new Headers({ "Content-Range": "bytes 0-0/1105713" })
      )
    ).toBe("1.05 MB")
  })

  it("uses Content-Length only for a complete response", () => {
    expect(
      getResponseFileSize(200, new Headers({ "Content-Length": "2048" }))
    ).toBe("2 KB")
    expect(
      getResponseFileSize(206, new Headers({ "Content-Length": "2048" }))
    ).toBeUndefined()
  })

  it("decodes the last non-empty path segment or returns the fallback", () => {
    expect(getLastPathSegment("/folder/a%20clip.mp4/", "Unknown File")).toBe(
      "a clip.mp4"
    )
    expect(getLastPathSegment("/", "Unknown File")).toBe("Unknown File")
  })
})
