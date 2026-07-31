import { useLocation } from "react-router"

export const PRODUCTION_ORIGIN = "https://lynvo.dg02002.workers.dev"

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/about",
  "/changelog",
  "/help-center",
  "/plugins",
  "/pricing",
  "/privacy",
  "/terms",
  "/policies/cookie-policy",
  "/policies/privacy-policy",
  "/policies/terms-of-use",
  "/policies/usage-policy",
])

export const PUBLIC_SITEMAP_PATHS = [...PUBLIC_EXACT_PATHS, "/docs"]

const normalizePathname = (pathname: string) => {
  if (pathname === "/") return pathname
  return pathname.replace(/\/+$/, "")
}

const isPublicPath = (pathname: string) =>
  PUBLIC_EXACT_PATHS.has(pathname) ||
  pathname === "/docs" ||
  pathname.startsWith("/docs/")

export const RouteSeoMetadata = () => {
  const pathname = normalizePathname(useLocation().pathname)
  const indexable = isPublicPath(pathname)
  const canonicalUrl = `${PRODUCTION_ORIGIN}${pathname}`
  const socialImageUrl = `${PRODUCTION_ORIGIN}/icons/brand/logo-512x512.png`

  return (
    <>
      <link
        rel="sitemap"
        type="application/xml"
        href={`${PRODUCTION_ORIGIN}/sitemap.xml`}
      />
      {indexable ? (
        <>
          <link rel="canonical" href={canonicalUrl} />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Lynvo" />
          <meta property="og:url" content={canonicalUrl} />
          <meta property="og:image" content={socialImageUrl} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:image" content={socialImageUrl} />
        </>
      ) : (
        <meta name="robots" content="noindex, nofollow" />
      )}
    </>
  )
}
