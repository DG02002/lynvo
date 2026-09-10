import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const successResponse = () =>
  Response.json({
    links: [
      {
        label: "episode.mkv",
        type: "file",
        url: "https://media.example/episode.mkv",
        mediaNodeKind: "playable",
      },
    ],
  })

const metadataResponse = () => Response.json({ title: "Example source" })

const fetchMock = vi.fn<typeof globalThis.fetch>()
let extractionClient: ExtractionTransport

describe("default extraction client", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock)
    extractionClient = (await import("~/lib/extraction/client"))
      .defaultExtractionClient
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it("recovers from a transient 503 without user action", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json(
          { code: "service_unavailable", error: "Try again", retryable: true },
          { status: 503 }
        )
      )
      .mockResolvedValueOnce(successResponse())

    const result = extractionClient.extract({ url: "https://source.example" })
    await vi.runAllTimersAsync()

    await expect(result).resolves.toMatchObject({
      links: [{ label: "episode.mkv" }],
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const requestIds = fetchMock.mock.calls.map(([input, init]) =>
      new Request(input, init).headers.get("x-request-id")
    )
    expect(requestIds[0]).toBeTruthy()
    expect(requestIds[0]).toBe(requestIds[1])
  })

  it("rejects a malformed successful extraction response", async () => {
    fetchMock.mockResolvedValue(Response.json({ links: "not-an-array" }))

    await expect(
      extractionClient.extract({ url: "https://source.example" })
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("uses bounded exponential backoff for transient retries", async () => {
    vi.mocked(Math.random).mockReturnValue(0.5)
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ error: "Try again" }, { status: 503 })
      )
      .mockResolvedValueOnce(
        Response.json({ error: "Try again" }, { status: 503 })
      )
      .mockResolvedValueOnce(successResponse())

    const result = extractionClient.extract({ url: "https://source.example" })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(374)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(624)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toMatchObject({
      links: [{ label: "episode.mkv" }],
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("waits for Retry-After before retrying a rate-limited response", async () => {
    vi.mocked(Math.random).mockReturnValue(0.5)
    fetchMock
      .mockResolvedValueOnce(
        Response.json(
          { code: "rate_limited", error: "Slow down", retryable: true },
          { status: 429, headers: { "Retry-After": "1" } }
        )
      )
      .mockResolvedValueOnce(successResponse())

    const result = extractionClient.extract({ url: "https://source.example" })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(125)
    await expect(result).resolves.toMatchObject({
      links: [{ label: "episode.mkv" }],
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not wait on an unbounded Retry-After hint", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { code: "rate_limited", error: "Slow down", retryable: true },
        { status: 429, headers: { "Retry-After": "3600" } }
      )
    )

    await expect(
      extractionClient.extract({ url: "https://source.example" })
    ).rejects.toMatchObject({ failure: { kind: "rate-limited" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not exceed the retry window after adding jitter", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { code: "rate_limited", error: "Slow down", retryable: true },
        { status: 429, headers: { "Retry-After": "20" } }
      )
    )

    await expect(
      extractionClient.extract({ url: "https://source.example" })
    ).rejects.toMatchObject({ failure: { kind: "rate-limited" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("recovers from a socket disconnect after an idle period", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(successResponse())

    const result = extractionClient.extract({ url: "https://source.example" })
    await vi.runAllTimersAsync()

    await expect(result).resolves.toMatchObject({
      links: [{ label: "episode.mkv" }],
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry an expired session", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { _tag: "UnauthorizedError", message: "Unauthorized" },
        { status: 401 }
      )
    )

    await expect(
      extractionClient.extract({ url: "https://source.example" })
    ).rejects.toMatchObject({ failure: { kind: "session-expired" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("times out a stalled request and bounds transient retries", async () => {
    fetchMock.mockImplementation(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          )
        })
    )

    const result = extractionClient.extract({ url: "https://source.example" })
    const failure = expect(result).rejects.toMatchObject({
      failure: { kind: "transient" },
    })
    await vi.runAllTimersAsync()

    await failure
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("distinguishes a Plugin Server transport failure", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { _tag: "ExtractionError", message: "TEMPORARY_FAILURE" },
        { status: 422 }
      )
    )

    await expect(
      extractionClient.extract({ url: "https://source.example" })
    ).rejects.toMatchObject({ failure: { kind: "plugin-server-down" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("retries metadata requests with the same resilience boundary", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ error: "Try again" }, { status: 503 })
      )
      .mockResolvedValueOnce(metadataResponse())

    const result = extractionClient.getMetadata({
      url: "https://source.example",
    })
    await vi.runAllTimersAsync()

    await expect(result).resolves.toMatchObject({ title: "Example source" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not label Plugin Server authentication failures as downtime", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { _tag: "ExtractionError", message: "AUTH_INVALID" },
        { status: 422 }
      )
    )

    await expect(
      extractionClient.extract({ url: "https://source.example" })
    ).rejects.toMatchObject({
      _tag: "ExtractionError",
      message: "AUTH_INVALID",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
