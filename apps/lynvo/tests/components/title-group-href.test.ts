import { describe, expect, it } from "vitest"
import {
  getTitleGroupHref,
  isSaveTitleDetailPath,
} from "~/features/links/title-grouping/title-group-href"

describe("getTitleGroupHref", () => {
  it("routes matched movies to the movie detail route", () => {
    expect(getTitleGroupHref("movie-id", "movie")).toBe("/save/movie/movie-id")
  })

  it("routes matched seasons to the show detail route", () => {
    expect(getTitleGroupHref("season-id", "tv-season")).toBe(
      "/save/show/season-id"
    )
  })

  it("routes unmatched groups to the generic title route", () => {
    expect(getTitleGroupHref("group-id", "unmatched")).toBe(
      "/save/title/group-id"
    )
  })

  it("encodes ids with unsafe characters", () => {
    expect(getTitleGroupHref("id with spaces", "movie")).toBe(
      "/save/movie/id%20with%20spaces"
    )
  })
})

describe("isSaveTitleDetailPath", () => {
  it("accepts every title detail prefix", () => {
    expect(isSaveTitleDetailPath("/save/title/group-id")).toBe(true)
    expect(isSaveTitleDetailPath("/save/movie/group-id")).toBe(true)
    expect(isSaveTitleDetailPath("/save/show/group-id")).toBe(true)
  })

  it("rejects other surfaces", () => {
    expect(isSaveTitleDetailPath("/save")).toBe(false)
    expect(isSaveTitleDetailPath("/save/folder/link-id")).toBe(false)
    expect(isSaveTitleDetailPath("/save/titles")).toBe(false)
    expect(isSaveTitleDetailPath("/settings")).toBe(false)
  })
})
