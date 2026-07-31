import {
  PRODUCTION_ORIGIN,
  PUBLIC_SITEMAP_PATHS,
} from "~/root/route-seo-metadata"

const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400"

export const loader = async () => {
  const urls = PUBLIC_SITEMAP_PATHS.map(
    (path) => `  <url><loc>${PRODUCTION_ORIGIN}${path}</loc></url>`
  ).join("\n")
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  return new Response(xml, {
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "Content-Type": "application/xml; charset=utf-8",
    },
  })
}
