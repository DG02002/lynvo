interface TitleGroupRouteBasePaths {
  readonly movie: string
  readonly "tv-season": string
  readonly unmatched: string
}

const TITLE_GROUP_ROUTE_BASE_PATHS = {
  movie: "/save/movie",
  "tv-season": "/save/show",
  unmatched: "/save/title",
} satisfies TitleGroupRouteBasePaths

const SAVE_TITLE_DETAIL_PATH_PREFIXES = [
  "/save/movie/",
  "/save/show/",
  "/save/title/",
]

export const getTitleGroupHref = (
  titleGroupId: string,
  mediaKind: TitleGroupProjection["mediaKind"]
) =>
  `${TITLE_GROUP_ROUTE_BASE_PATHS[mediaKind]}/${encodeURIComponent(titleGroupId)}`

export const isSaveTitleDetailPath = (pathname: string) =>
  SAVE_TITLE_DETAIL_PATH_PREFIXES.some((pathPrefix) =>
    pathname.startsWith(pathPrefix)
  )
