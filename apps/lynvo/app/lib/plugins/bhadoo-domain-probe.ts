import { createBasicAuthorization } from "./bhadoo-basic-auth"

const getProbeUrls = (value: string) => {
  const candidateUrl = new URL(
    value.includes("://") ? value : `https://${value}`
  )
  return [candidateUrl, new URL("/0:/", candidateUrl.origin)].filter(
    (url, index, urls) =>
      urls.findIndex((candidate) => candidate.href === url.href) === index
  )
}

export const probeBhadooDomain = async (
  value: string,
  username?: string,
  password?: string
) => {
  for (const url of getProbeUrls(value)) {
    try {
      const response = await fetch(url, {
        headers: username
          ? {
              Authorization: createBasicAuthorization(username, password || ""),
            }
          : {},
        signal: AbortSignal.timeout(10_000),
      })
      if (response.status === 401) {
        return 401
      }
    } catch {
      continue
    }
  }

  return undefined
}
