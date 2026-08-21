export interface ConvexAccessTokenAuthenticated {
  readonly kind: "authenticated"
  readonly accessToken: string
}

export interface ConvexAccessTokenUnauthenticated {
  readonly kind: "unauthenticated"
}

export interface ConvexAccessTokenUnavailable {
  readonly kind: "unavailable"
}

export interface ConvexAccessTokenHandlerDependencies {
  readonly checkRateLimit: (
    request: Request
  ) => Promise<"allowed" | "limited" | "unavailable">
  readonly resolveAccessToken: (
    request: Request,
    forceRefresh: boolean
  ) => Promise<
    | ConvexAccessTokenAuthenticated
    | ConvexAccessTokenUnauthenticated
    | ConvexAccessTokenUnavailable
  >
}

const noStoreResponse = (body: BodyInit | null, status: number): Response =>
  new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  })

export const createConvexAccessTokenHandler =
  (dependencies: ConvexAccessTokenHandlerDependencies) =>
  async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const origin = request.headers.get("Origin")
    const host = request.headers.get("Host")
    if (origin) {
      try {
        const originUrl = new URL(origin)
        const isSameOrigin =
          origin === url.origin ||
          Boolean(host && originUrl.host === host) ||
          Boolean(
            (originUrl.hostname === "localhost" &&
              url.hostname === "127.0.0.1") ||
            (originUrl.hostname === "127.0.0.1" && url.hostname === "localhost")
          )
        if (!isSameOrigin) {
          return noStoreResponse(JSON.stringify({ error: "Forbidden" }), 403)
        }
      } catch {
        return noStoreResponse(JSON.stringify({ error: "Forbidden" }), 403)
      }
    }

    const rateLimit = await dependencies.checkRateLimit(request)
    if (rateLimit !== "allowed") {
      return noStoreResponse(
        JSON.stringify({
          error:
            rateLimit === "limited"
              ? "Too many requests"
              : "Service unavailable",
        }),
        rateLimit === "limited" ? 429 : 503
      )
    }

    const result = await dependencies.resolveAccessToken(
      request,
      url.searchParams.get("forceRefresh") === "true"
    )
    if (result.kind !== "authenticated") {
      return noStoreResponse(
        JSON.stringify({
          error:
            result.kind === "unauthenticated"
              ? "Authentication required"
              : "Service unavailable",
        }),
        result.kind === "unauthenticated" ? 401 : 503
      )
    }

    return noStoreResponse(
      JSON.stringify({ accessToken: result.accessToken }),
      200
    )
  }
