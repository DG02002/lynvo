export const ONEDRIVE_FETCH_RETRIES = 3
export const ONEDRIVE_FETCH_RETRY_DELAY_MS = 2000
export const ONEDRIVE_DETECTION_TIMEOUT_MS = 5000

export const sha256 = async (message: string) => {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

const delay = (durationMs: number) =>
  new Promise((resolve) => setTimeout(resolve, durationMs))

export const fetchWithRetry = async (
  targetUrl: string,
  options: RequestInit,
  retries = ONEDRIVE_FETCH_RETRIES,
  retryDelayMs = ONEDRIVE_FETCH_RETRY_DELAY_MS,
  attempt = 0
): Promise<Response> => {
  try {
    const response = await fetch(targetUrl, options)
    if (response.ok || response.status === 401) {
      return response
    }
    if (
      (response.status >= 500 || response.status === 429) &&
      attempt < retries - 1
    ) {
      await delay(retryDelayMs)
      return fetchWithRetry(
        targetUrl,
        options,
        retries,
        retryDelayMs,
        attempt + 1
      )
    }
    return response
  } catch (error) {
    if (attempt < retries - 1) {
      await delay(retryDelayMs)
      return fetchWithRetry(
        targetUrl,
        options,
        retries,
        retryDelayMs,
        attempt + 1
      )
    }
    throw error
  }
}
