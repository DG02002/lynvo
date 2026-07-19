import * as cheerio from "cheerio"
import { isSafeUrl } from "./ssrf"

export interface ScrapeResult {
  headers: Headers
  status: number
  statusText: string
  body: string | null // Body is null for HEAD requests
  $: cheerio.CheerioAPI | null // Cheerio instance if body is HTML
}

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "max-age=0",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
}

/**
 * Fetches a URL with browser-like headers.
 * Can perform HEAD or GET requests.
 */

const CACHE_TTL = 10000 // 10 seconds
const requestCache = new Map<
  string,
  { promise: Promise<ScrapeResult>; timestamp: number }
>()

/**
 * Fetches a URL with browser-like headers.
 * Can perform HEAD or GET requests.
 */
export async function fetchUrl(
  url: string,
  method: "HEAD" | "GET" = "GET"
): Promise<ScrapeResult> {
  if (!isSafeUrl(url)) {
    throw new Error("Invalid or unsafe URL")
  }

  // Generate cache key
  const cacheKey = `${method}:${url}`
  const now = Date.now()

  // Check cache
  const cached = requestCache.get(cacheKey)
  if (cached && now - cached.timestamp < CACHE_TTL) {
    // Return cached promise (cloning result to avoid mutation issues if any)
    const result = await cached.promise
    return {
      ...result,
      // Clone cheerio instance if it exists?
      // Cheerio instances are mutable, but typically we just read from them.
      // For safety, we might want to reload $ if we were modifying it, but here we just read.
      // However, the `body` is immutable string.
    }
  }

  // Clean up old cache entries occasionally (lazy cleanup)
  if (requestCache.size > 100) {
    for (const [key, entry] of requestCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        requestCache.delete(key)
      }
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout

  const performFetch = async (): Promise<ScrapeResult> => {
    try {
      const headers: Record<string, string> = { ...DEFAULT_HEADERS }
      if (method === "GET") {
        headers["Range"] = "bytes=0-131072"
      }

      const response = await fetch(url, {
        method,
        headers,
        redirect: "follow",
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      let body = null
      let $ = null

      if (method === "GET") {
        const contentType = response.headers.get("content-type") || ""
        const contentLength = response.headers.get("content-length")

        const isScrapable =
          contentType.includes("text/") ||
          contentType.includes("json") ||
          contentType.includes("xml") ||
          contentType.includes("application/xhtml+xml")

        const isPartial = response.status === 206
        const isLarge =
          contentLength && parseInt(contentLength) > 10 * 1024 * 1024

        if (isScrapable && (isPartial || !isLarge)) {
          body = await response.text()
          if (contentType.includes("text/html")) {
            $ = cheerio.load(body)
          }
        }
      }

      return {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
        body,
        $,
      }
    } catch (error) {
      clearTimeout(timeoutId)
      // Remove from cache on error so we can retry
      requestCache.delete(cacheKey)
      throw error
    }
  }

  const fetchPromise = performFetch()
  requestCache.set(cacheKey, { promise: fetchPromise, timestamp: now })

  return fetchPromise
}
