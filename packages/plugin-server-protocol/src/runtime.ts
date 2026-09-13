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
import {
  isProtocolError,
  PROTOCOL_ERROR_STATUS,
  toProtocolErrorResponse,
} from "./errors.js"
import {
  canPluginServerAttemptTarget,
  getExtractTarget,
  getMatchedPlugin,
} from "./matching.js"
import type {
  ExtractRequest,
  ExtractTarget,
  PluginServerManifest,
  PluginServerManifestFactory,
  PluginServerRuntime,
  PluginServerRuntimeManifest,
  PluginServerRuntimeOptions,
  VerifySuccessResponse,
} from "./models.js"

interface ExtractExecutionOptions<Env> {
  readonly request: Request
  readonly env: Env
  readonly parsedRequest: ExtractRequest
  readonly target: ExtractTarget
}

const isManifestFactory = <Env>(
  manifest: PluginServerRuntimeManifest<Env>
): manifest is PluginServerManifestFactory<Env> =>
  typeof manifest === "function"

const jsonResponse = <Value>(value: Value, status = 200): Response =>
  Response.json(value, { status })

export const createPluginServerRuntime = <Env>(
  options: PluginServerRuntimeOptions<Env>
): PluginServerRuntime<Env> => {
  const resolveManifest = async (
    request: Request,
    env: Env
  ): Promise<PluginServerManifest | undefined> => {
    const value = isManifestFactory(options.manifest)
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

  const executeExtract = async ({
    request,
    env,
    parsedRequest,
    target,
  }: ExtractExecutionOptions<Env>): Promise<Response> => {
    try {
      const result = await options.extract({
        request: parsedRequest,
        target,
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
            request: parsedRequest,
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
          PROTOCOL_ERROR_STATUS.UNSUPPORTED_URL
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
          PROTOCOL_ERROR_STATUS.TEMPORARY_FAILURE
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
      const parsedRequest = parsed.success
      const target = getExtractTarget(parsedRequest)
      const manifest = await resolveManifest(request, env)
      if (!manifest) {
        return protocolMismatchResponse(
          "Plugin Server Manifest does not match protocol v1."
        )
      }
      if (
        !canPluginServerAttemptTarget(manifest, target, parsed.success.pluginId)
      ) {
        return jsonResponse(
          createProtocolError(
            "UNSUPPORTED_URL",
            `Unsupported extraction target by this Plugin Server: ${
              target.kind === "url" ? target.url : target.resourceId
            }`
          ),
          400
        )
      }

      const matchedPluginId =
        target.kind === "url"
          ? getMatchedPlugin(manifest, target.url)?.id
          : parsedRequest.pluginId
      await runHook(
        async () => {
          await options.onExtractAccepted?.({
            request: parsedRequest,
            target,
            manifest,
            matchedPluginId,
            runtimeContext: { request, env },
          })
        },
        request,
        env
      )
      return executeExtract({ request, env, parsedRequest, target })
    },
  }
}
