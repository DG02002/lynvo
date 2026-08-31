import { Result, Schema } from "effect"
import {
  discoverRequestSchema,
  discoverResponseSchema,
  extractRequestSchema,
} from "./schemas.js"
import {
  parseExtractSuccessContract,
  parsePluginServerManifestContract,
  parseUsageResponseContract,
} from "./contracts.js"
import { createProtocolError } from "./requests.js"
import { isProtocolError, toProtocolErrorResponse } from "./errors.js"
import {
  canPluginServerAttemptUrl,
  getExtractTargetUrl,
  getMatchedPlugin,
} from "./matching.js"
import type {
  PluginServerManifest,
  PluginServerRuntime,
  PluginServerRuntimeOptions,
  VerifySuccessResponse,
} from "./models.js"

const jsonResponse = <Value>(value: Value, status = 200): Response =>
  Response.json(value, { status })

export const createPluginServerRuntime = <Env>(
  options: PluginServerRuntimeOptions<Env>
): PluginServerRuntime<Env> => {
  const resolveManifest = async (
    request: Request,
    env: Env
  ): Promise<PluginServerManifest | undefined> => {
    const value =
      options.manifest instanceof Function
        ? await options.manifest({ request, env })
        : options.manifest
    const parsed = parsePluginServerManifestContract(value)
    return parsed.ok && parsed.value ? parsed.value : undefined
  }

  const runHook = async (
    hook: () => Promise<void>,
    request: Request,
    env: Env
  ): Promise<void> => {
    try {
      await hook()
    } catch (error) {
      options.onError?.(error, { request, env })
    }
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
      try {
        const usage = await options.usage({ request, env })
        const parsed = parseUsageResponseContract(usage)
        if (!parsed.ok || !parsed.value) {
          return jsonResponse(
            createProtocolError(
              "PROTOCOL_MISMATCH",
              "Plugin Server returned an invalid usage response."
            ),
            500
          )
        }
        return jsonResponse(parsed.value)
      } catch (error) {
        options.onError?.(error, { request, env })
        return jsonResponse(
          createProtocolError("TEMPORARY_FAILURE", "Failed to retrieve usage."),
          500
        )
      }
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
      const parsed = Schema.decodeUnknownResult(discoverRequestSchema)(body)
      if (Result.isFailure(parsed)) {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid discovery request."),
          400
        )
      }

      try {
        const result = await options.discover({
          request: parsed.success,
          targetUrl: parsed.success.url,
          env,
        })
        const parsedResult = Schema.decodeUnknownResult(discoverResponseSchema)(
          result
        )
        return Result.isSuccess(parsedResult)
          ? jsonResponse(parsedResult.success)
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

      const parsed = Schema.decodeUnknownResult(extractRequestSchema)(body)
      if (Result.isFailure(parsed)) {
        return jsonResponse(
          createProtocolError("BAD_REQUEST", "Invalid request body."),
          400
        )
      }

      const targetUrl = getExtractTargetUrl(parsed.success)
      const manifest = await resolveManifest(request, env)
      if (!manifest) {
        return protocolMismatchResponse(
          "Plugin Server Manifest does not match protocol v1."
        )
      }
      if (
        !canPluginServerAttemptUrl(manifest, targetUrl, parsed.success.pluginId)
      ) {
        return jsonResponse(
          createProtocolError(
            "UNSUPPORTED_URL",
            `Unsupported URL by this Plugin Server: ${targetUrl}`
          ),
          400
        )
      }

      const matchedPluginId = getMatchedPlugin(manifest, targetUrl)?.id
      await runHook(
        async () => {
          await options.onExtractAccepted?.({
            request: parsed.success,
            targetUrl,
            manifest,
            matchedPluginId,
            runtimeContext: { request, env },
          })
        },
        request,
        env
      )

      try {
        const result = await options.extract({
          request: parsed.success,
          targetUrl,
          env,
        })
        const parsedResult = parseExtractSuccessContract(result)
        const successResult = parsedResult.ok ? parsedResult.value : undefined
        if (!successResult) {
          return jsonResponse(
            createProtocolError(
              "PROTOCOL_MISMATCH",
              "Plugin Server returned an invalid response."
            ),
            500
          )
        }
        await runHook(
          async () => {
            await options.onExtractResult?.({
              request: parsed.success,
              result: successResult,
              runtimeContext: { request, env },
            })
          },
          request,
          env
        )
        return jsonResponse(successResult)
      } catch (error) {
        options.onError?.(error, { request, env })
        if (isProtocolError(error)) {
          return toProtocolErrorResponse(error)
        }
        const message = error instanceof Error ? error.message : String(error)
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
