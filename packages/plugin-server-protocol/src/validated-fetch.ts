import type { JsonValue } from "./models.js"

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const REDIRECT_REQUEST_BODY_HEADERS = [
  "Content-Encoding",
  "Content-Language",
  "Content-Location",
  "Content-Type",
] as const

export type ValidatedFetchErrorCode =
  | "TOO_MANY_REDIRECTS"
  | "INVALID_REDIRECT"
  | "RESPONSE_TOO_LARGE"

export class ValidatedFetchError extends Error {
  readonly code: ValidatedFetchErrorCode

  constructor(code: ValidatedFetchErrorCode, message: string) {
    super(message)
    this.name = "ValidatedFetchError"
    this.code = code
  }
}

export interface ValidatedRedirectFetchOptions {
  readonly fetch?: typeof globalThis.fetch
  readonly validateUrl: (value: string | URL) => URL
  readonly maxRedirects: number
  readonly timeoutMs: number
  readonly maximumResponseBytes: number
  readonly responseBodyMode?: "read" | "stream" | "discard"
  readonly stripHeadersOnCrossOrigin?: readonly string[]
  readonly validateRedirect?: (input: {
    readonly status: number
    readonly currentUrl: URL
    readonly nextUrl: URL
  }) => void
}

interface RequestState {
  readonly currentUrl: URL
  readonly method: string
  readonly body: RequestInit["body"]
  readonly headers: RequestInit["headers"]
}

interface FetchDeadline {
  readonly signal: AbortSignal
  readonly timeoutPromise: Promise<never>
  readonly timeoutError: Error
  readonly isTimedOut: () => boolean
  readonly setReader: (reader: ReadableStreamDefaultReader<Uint8Array>) => void
  readonly clearReader: (
    reader: ReadableStreamDefaultReader<Uint8Array>
  ) => void
  readonly abort: () => void
  readonly dispose: () => void
}

interface StreamingResponseState {
  readonly response: Response
  readonly sourceBody: ReadableStream<Uint8Array>
  readonly maximumResponseBytes: number
  readonly deadline: FetchDeadline
  reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  checkedDeclaredLength: boolean
  responseByteLength: number
}

interface FetchValidatedRedirectInput {
  readonly requestFetch: typeof globalThis.fetch
  readonly state: RequestState
  readonly options: RequestInit
  readonly configuration: ValidatedRedirectFetchOptions
  readonly redirectCount: number
}

const createTimeoutError = (): Error => {
  const error = new Error("Outbound request timed out.")
  error.name = "TimeoutError"
  return error
}

const createFetchDeadline = (timeoutMs: number): FetchDeadline => {
  const controller = new AbortController()
  const timeoutError = createTimeoutError()
  let timedOut = false
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let rejectTimeout!: (error: Error) => void
  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectTimeout = reject
  })
  // The streaming response mode does not await this promise directly.
  void timeoutPromise.catch(() => undefined)
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(timeoutError)
    rejectTimeout(timeoutError)
    void activeReader?.cancel(timeoutError).catch(() => undefined)
  }, timeoutMs)

  return {
    signal: controller.signal,
    timeoutPromise,
    timeoutError,
    isTimedOut: () => timedOut,
    setReader: (reader) => {
      activeReader = reader
    },
    clearReader: (reader) => {
      if (activeReader === reader) {
        activeReader = undefined
      }
    },
    abort: () => {
      if (!controller.signal.aborted) {
        controller.abort()
      }
    },
    dispose: () => {
      clearTimeout(timer)
      activeReader = undefined
    },
  }
}

const createRequestState = (
  targetUrl: string | URL,
  options: RequestInit,
  validateUrl: (value: string | URL) => URL
): RequestState => ({
  currentUrl: validateUrl(targetUrl),
  method: (options.method ?? "GET").toUpperCase(),
  body: options.body,
  headers: options.headers,
})

const createRequestInit = (
  state: RequestState,
  options: RequestInit,
  signal: AbortSignal
): RequestInit => ({
  ...options,
  method: state.method,
  body: state.body,
  headers: state.headers,
  redirect: "manual",
  signal,
})

const getValidatedRedirectTarget = (
  response: Response,
  state: RequestState,
  validateUrl: (value: string | URL) => URL
): URL => {
  const location = response.headers.get("Location")
  if (!location) {
    throw new ValidatedFetchError(
      "INVALID_REDIRECT",
      "Redirect is missing a destination."
    )
  }
  return validateUrl(new URL(location, state.currentUrl))
}

const getRedirectRequestState = ({
  response,
  redirectCount,
  state,
  configuration,
}: {
  readonly response: Response
  readonly redirectCount: number
  readonly state: RequestState
  readonly configuration: ValidatedRedirectFetchOptions
}): RequestState => {
  if (redirectCount >= configuration.maxRedirects) {
    throw new ValidatedFetchError(
      "TOO_MANY_REDIRECTS",
      "Redirect limit exceeded."
    )
  }
  const nextUrl = getValidatedRedirectTarget(
    response,
    state,
    configuration.validateUrl
  )
  const { status } = response
  configuration.validateRedirect?.({
    status,
    currentUrl: state.currentUrl,
    nextUrl,
  })

  const { method } = state
  const shouldConvertToGet =
    ((status === 301 || status === 302) && method === "POST") ||
    (status === 303 && method !== "GET" && method !== "HEAD")
  const isCrossOrigin = state.currentUrl.origin !== nextUrl.origin
  if (!shouldConvertToGet && !isCrossOrigin) {
    return {
      currentUrl: nextUrl,
      method,
      body: state.body,
      headers: state.headers,
    }
  }

  const headers = new Headers(state.headers)
  if (shouldConvertToGet) {
    for (const headerName of REDIRECT_REQUEST_BODY_HEADERS) {
      headers.delete(headerName)
    }
  }
  if (isCrossOrigin) {
    for (const headerName of configuration.stripHeadersOnCrossOrigin ?? []) {
      headers.delete(headerName)
    }
  }
  return {
    currentUrl: nextUrl,
    method: shouldConvertToGet ? "GET" : method,
    body: shouldConvertToGet ? null : state.body,
    headers,
  }
}

const createResponseTooLargeError = (): ValidatedFetchError =>
  new ValidatedFetchError(
    "RESPONSE_TOO_LARGE",
    "Response exceeded its byte limit."
  )

const getDeclaredResponseLength = (response: Response): number =>
  Number(response.headers.get("Content-Length"))

const combineResponseChunks = (
  chunks: readonly Uint8Array[],
  byteCount: number
): ArrayBuffer => {
  const bytes = new Uint8Array(byteCount)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes.buffer
}

const ensureDeclaredResponseWithinLimit = async (
  response: Response,
  maximumResponseBytes: number,
  deadline?: FetchDeadline
): Promise<void> => {
  const declaredLength = getDeclaredResponseLength(response)
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maximumResponseBytes
  ) {
    const error = createResponseTooLargeError()
    deadline?.abort()
    await response.body?.cancel()
    throw error
  }
}

const rejectOversizedResponse = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadline?: FetchDeadline
): Promise<never> => {
  const error = createResponseTooLargeError()
  deadline?.abort()
  await reader.cancel().catch(() => undefined)
  throw error
}

const readResponseChunk = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadline?: FetchDeadline
): Promise<ReadableStreamReadResult<Uint8Array>> =>
  deadline
    ? Promise.race([reader.read(), deadline.timeoutPromise])
    : reader.read()

const readResponseChunks = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maximumResponseBytes: number,
  deadline?: FetchDeadline
): Promise<{ chunks: Uint8Array[]; byteCount: number }> => {
  const chunks: Uint8Array[] = []
  let byteCount = 0
  while (true) {
    // oxlint-disable-next-line no-await-in-loop -- Chunks must be checked in order.
    const result = await readResponseChunk(reader, deadline)
    if (deadline?.isTimedOut()) {
      throw deadline.timeoutError
    }
    if (result.done) {
      return { chunks, byteCount }
    }
    const nextByteCount = byteCount + result.value.byteLength
    if (nextByteCount > maximumResponseBytes) {
      return rejectOversizedResponse(reader, deadline)
    }
    chunks.push(result.value)
    byteCount = nextByteCount
  }
}

const readResponseBytes = async (
  response: Response,
  maximumResponseBytes: number,
  deadline?: FetchDeadline
): Promise<ArrayBuffer> => {
  await ensureDeclaredResponseWithinLimit(
    response,
    maximumResponseBytes,
    deadline
  )
  if (!response.body) {
    return new ArrayBuffer(0)
  }

  const reader = response.body.getReader()
  deadline?.setReader(reader)
  try {
    const { chunks, byteCount } = await readResponseChunks(
      reader,
      maximumResponseBytes,
      deadline
    )
    return combineResponseChunks(chunks, byteCount)
  } catch (error) {
    if (deadline?.isTimedOut()) {
      void reader.cancel().catch(() => undefined)
      throw deadline.timeoutError
    }
    throw error
  } finally {
    deadline?.clearReader(reader)
    reader.releaseLock()
  }
}

const readStreamingResponseChunk = async (
  state: StreamingResponseState
): Promise<Uint8Array | undefined> => {
  if (!state.checkedDeclaredLength) {
    state.checkedDeclaredLength = true
    const declaredLength = getDeclaredResponseLength(state.response)
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > state.maximumResponseBytes
    ) {
      throw createResponseTooLargeError()
    }
  }
  const sourceReader = state.reader ?? state.sourceBody.getReader()
  if (!state.reader) {
    state.reader = sourceReader
    state.deadline.setReader(sourceReader)
  }
  const result = await readResponseChunk(sourceReader, state.deadline)
  if (state.deadline.isTimedOut()) {
    throw state.deadline.timeoutError
  }
  if (result.done) {
    return undefined
  }
  state.responseByteLength += result.value.byteLength
  if (state.responseByteLength > state.maximumResponseBytes) {
    throw createResponseTooLargeError()
  }
  return result.value
}

const createStreamingResponse = (
  response: Response,
  maximumResponseBytes: number,
  deadline: FetchDeadline
): Response => {
  if (!response.body) {
    deadline.dispose()
    return response
  }

  const sourceBody = response.body
  const state: StreamingResponseState = {
    response,
    sourceBody,
    maximumResponseBytes,
    deadline,
    reader: undefined,
    checkedDeclaredLength: false,
    responseByteLength: 0,
  }
  let finished = false
  const finish = (): void => {
    if (finished) {
      return
    }
    finished = true
    if (state.reader) {
      deadline.clearReader(state.reader)
      state.reader.releaseLock()
    }
    deadline.dispose()
  }
  const cancelReader = async (): Promise<void> => {
    const cancelPromise = (async (): Promise<void> => {
      if (state.reader) {
        await state.reader.cancel().catch(() => undefined)
      }
      await sourceBody.cancel().catch(() => undefined)
    })()
    if (state.deadline.isTimedOut()) {
      void cancelPromise
    } else {
      await cancelPromise
    }
    finish()
  }

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await readStreamingResponseChunk(state)
        if (chunk === undefined) {
          controller.close()
          finish()
          return
        }
        controller.enqueue(chunk)
      } catch (error) {
        deadline.abort()
        await cancelReader()
        controller.error(error)
      }
    },
    async cancel() {
      await cancelReader()
    },
  })

  return new Response(body, response)
}

const readFinalResponse = async ({
  response,
  deadline,
  configuration,
}: {
  readonly response: Response
  readonly deadline: FetchDeadline
  readonly configuration: ValidatedRedirectFetchOptions
}): Promise<Response> => {
  const responseBodyMode = configuration.responseBodyMode ?? "stream"
  try {
    if (responseBodyMode === "discard") {
      await response.body?.cancel()
      return new Response(null, response)
    }
    if (responseBodyMode === "stream") {
      return createStreamingResponse(
        response,
        configuration.maximumResponseBytes,
        deadline
      )
    }
    const responseBody = await readResponseBytes(
      response,
      configuration.maximumResponseBytes,
      deadline
    )
    return new Response(responseBody, response)
  } finally {
    if (responseBodyMode !== "stream") {
      deadline.dispose()
    }
  }
}

const fetchValidatedRedirect = async ({
  requestFetch,
  state,
  options,
  configuration,
  redirectCount,
}: FetchValidatedRedirectInput): Promise<Response> => {
  const deadline = createFetchDeadline(configuration.timeoutMs)
  let response: Response
  try {
    response = await requestFetch(
      state.currentUrl,
      createRequestInit(state, options, deadline.signal)
    )
  } catch (error) {
    deadline.dispose()
    throw error
  }

  if (REDIRECT_STATUSES.has(response.status)) {
    let nextState: RequestState
    try {
      nextState = getRedirectRequestState({
        response,
        redirectCount,
        state,
        configuration,
      })
    } finally {
      try {
        await response.body?.cancel()
      } finally {
        deadline.dispose()
      }
    }
    return fetchValidatedRedirect({
      requestFetch,
      state: nextState,
      options,
      configuration,
      redirectCount: redirectCount + 1,
    })
  }

  return readFinalResponse({
    response,
    deadline,
    configuration,
  })
}

export const fetchValidatedRedirects = (
  targetUrl: string | URL,
  options: RequestInit,
  configuration: ValidatedRedirectFetchOptions
): Promise<Response> => {
  const requestFetch = configuration.fetch ?? globalThis.fetch
  const state = createRequestState(
    targetUrl,
    options,
    configuration.validateUrl
  )
  return fetchValidatedRedirect({
    requestFetch,
    state,
    options,
    configuration,
    redirectCount: 0,
  })
}

export interface ReadBoundedResponseOptions {
  readonly maximumResponseBytes: number
  readonly timeoutMs?: number
}

export const readBoundedResponseText = async (
  response: Response,
  options: ReadBoundedResponseOptions
): Promise<string> => {
  const deadline =
    options.timeoutMs === undefined
      ? undefined
      : createFetchDeadline(options.timeoutMs)
  try {
    const bytes = await readResponseBytes(
      response,
      options.maximumResponseBytes,
      deadline
    )
    return new TextDecoder().decode(bytes)
  } finally {
    deadline?.dispose()
  }
}

export const readBoundedResponseJson = async (
  response: Response,
  options: ReadBoundedResponseOptions
): Promise<JsonValue> => {
  const value = JSON.parse(await readBoundedResponseText(response, options))
  // SAFETY: JSON.parse returns a value from the JSON data model.
  return value as JsonValue
}
