import { load } from "cheerio"
import type { OneDriveApiResponse } from "./onedrive-index-extractor"

export const extractOneDriveNextData = (html: string) => {
  const $ = load(html)
  const nextData = $("#__NEXT_DATA__").html()
  if (!nextData) {
    return null
  }

  const json = JSON.parse(nextData)
  const pageProps = json.props?.pageProps
  return pageProps?.folder || pageProps?.file
    ? (pageProps as OneDriveApiResponse)
    : null
}
