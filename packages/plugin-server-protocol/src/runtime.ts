import {
  discoverRequestSchema,
  discoverResponseSchema,
  extractRequestSchema,
} from "./schemas"
import {
  parseExtractSuccessContract,
  parsePluginServerManifestContract,
  parseUsageResponseContract,
} from "./contracts"
import { createProtocolError } from "./requests"
import { getExtractTargetUrl, matchPluginServerUrl } from "./matching"
import type {
  PluginServerManifest,
  PluginServerRuntime,
  PluginServerRuntimeOptions,
  VerifySuccessResponse,
} from "./models"

const jsonResponse = (value: unknown, status = 200): Response =>
  Response.json(value, { status })

export const createPluginServerRuntime = <Env>(
  options: PluginServerRuntimeOptions<Env>
): PluginServerRuntime<Env> => {
  const resolveManifest = async (
    request: Request,
    env: Env
  ): Promise<PluginServerManifest | undefined> => {
    const value =
      typeof options.manifest === "function"
        ? await options.manifest({ request, env })
        : options.manifest
    const parsed = parsePluginServerManifestContract(value)
    return parsed.ok && parsed.value ? parsed.value : undefined
  }

  const protocolMismatchResponse = (message: string): Response =>
    jsonResponse(createProtocolError("PROTOCOL_MISMATCH", message), 500)

  const authenticate = async (
    request: Request,
    env: Env
  ): Promise<Response | undefined> => {
    const isAuthenticated = await options.auth.validate({ request, env })
    return isAuthenticated
      ? undefined
      : jsonResponse(
          createProtocolError("AUTH_INVALID", "API key was rejected."),
          401
        )
  }

  return {
    handleManifest: async (request, env) => {
      const manifest = await resolveManifest(request, env)
      return manifest
        ? jsonResponse(manifest)
        : protocolMismatchResponse(
            "Plugin Server Manifest does not match protocol v1."
          )
    },
    handleVerify: async (request, env) => {
      const authFailure = await authenticate(request, env)
      if (authFailure) {
        return authFailure
      }
      return jsonResponse({ ok: true } satisfies VerifySuccessResponse)
    },
    handleUsage: async (request, env) => {
      const authFailure = await authenticate(request, env)
      if (authFailure) {
        return authFailure
      }
      const usage = await options.usage({ request, env })
      const parsedUsage = parseUsageResponseContract(usage)
      if (!parsedUsage.ok || !parsedUsage.value) {
        return jsonResponse(
          createProtocolError(
            "PROTOCOL_MISMATCH",
            "Plugin Server returned invalid usage metrics."
          ),
          500
        )
      }
      return jsonResponse(parsedUsage.value)
    },
    handleDiscover: async (request, env) => {
      const authFailure = await authenticate(request, env)
      if (authFailure) {
        return authFailure
      }
      if (!options.discover) {
        return jsonResponse(
          createProtocolError(
            "UNSUPPORTED_URL",
            "This Plugin Server does not support source discovery."
          ),
          404
        )
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid JSON body."),
          400
        )
      }
      const parsed = discoverRequestSchema.safeParse(body)
      if (!parsed.success) {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid discovery request."),
          400
        )
      }

      try {
        const result = await options.discover({
          request: parsed.data,
          targetUrl: parsed.data.url,
          env,
        })
        const parsedResult = discoverResponseSchema.safeParse(result)
        return parsedResult.success
          ? jsonResponse(parsedResult.data)
          : jsonResponse(
              createProtocolError(
                "PROTOCOL_MISMATCH",
                "Plugin Server returned an invalid discovery response."
              ),
              500
            )
      } catch (error) {
        options.onError?.(error, { request, env })
        return jsonResponse(
          createProtocolError("TEMPORARY_FAILURE", "Source discovery failed."),
          502
        )
      }
    },
    handleExtract: async (request, env) => {
      const authFailure = await authenticate(request, env)
      if (authFailure) {
        return authFailure
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid JSON body."),
          400
        )
      }

      const parsed = extractRequestSchema.safeParse(body)
      if (!parsed.success) {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid request body."),
          400
        )
      }

      const targetUrl = getExtractTargetUrl(parsed.data)
      const manifest = await resolveManifest(request, env)
      if (!manifest) {
        return protocolMismatchResponse(
          "Plugin Server Manifest does not match protocol v1."
        )
      }
      if (!matchPluginServerUrl(targetUrl, manifest.matchers)) {
        return jsonResponse(
          createProtocolError(
            "UNSUPPORTED_URL",
            `Unsupported URL by this Plugin Server: ${targetUrl}`
          ),
          400
        )
      }

      try {
        const result = await options.extract({
          request: parsed.data,
          targetUrl,
          env,
        })
        const parsedResult = parseExtractSuccessContract(result)
        if (!parsedResult.ok || !parsedResult.value) {
          return jsonResponse(
            createProtocolError(
              "PROTOCOL_MISMATCH",
              "Plugin Server returned an invalid response."
            ),
            500
          )
        }
        return jsonResponse(parsedResult.value)
      } catch (error) {
        options.onError?.(error, { request, env })
        const message = error instanceof Error ? error.message : String(error)
        if (message === "PASSWORD_REQUIRED") {
          return jsonResponse(
            createProtocolError(
              "PASSWORD_REQUIRED",
              "Password is required for this resource."
            ),
            401
          )
        }
        if (message === "INVALID_PASSWORD") {
          return jsonResponse(
            createProtocolError(
              "INVALID_PASSWORD",
              "The supplied password was rejected."
            ),
            401
          )
        }
        if (message === "RATE_LIMITED") {
          return jsonResponse(
            createProtocolError(
              "RATE_LIMITED",
              "Plugin Server capacity is exhausted for the current period."
            ),
            429
          )
        }
        if (message === "UNSUPPORTED_URL") {
          return jsonResponse(
            createProtocolError(
              "UNSUPPORTED_URL",
              "The target URL is not supported."
            ),
            400
          )
        }
        return jsonResponse(
          createProtocolError(
            "TEMPORARY_FAILURE",
            message || "Failed to extract links."
          ),
          500
        )
      }
    },
  }
}
