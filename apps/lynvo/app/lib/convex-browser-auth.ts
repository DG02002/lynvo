import { z } from "zod"

export interface ConvexAccessTokenFetcherDependencies {
  readonly fetchRequest: typeof fetch
  readonly onSessionExpired: () => void
}

export interface ConvexAccessTokenFetchOptions {
  readonly forceRefreshToken: boolean
}

const convexAccessTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
})

export class ConvexAccessUnavailableError extends Error {
  constructor() {
    super("Convex authentication is temporarily unavailable")
    this.name = "ConvexAccessUnavailableError"
  }
}

export const createConvexAccessTokenFetcher =
  (dependencies: ConvexAccessTokenFetcherDependencies) =>
  async ({
    forceRefreshToken,
  }: ConvexAccessTokenFetchOptions): Promise<string | null> => {
    const query = forceRefreshToken ? "?forceRefresh=true" : ""
    let response: Response
    try {
      response = await dependencies.fetchRequest(
        `/api/auth/convex-token${query}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        }
      )
    } catch {
      return null
    }

    if (response.status === 401 || response.status === 403) {
      dependencies.onSessionExpired()
      return null
    }
    if (!response.ok) {
      return null
    }
    const result = convexAccessTokenResponseSchema.safeParse(
      await response.json()
    )
    if (!result.success) {
      return null
    }
    return result.data.accessToken
  }
