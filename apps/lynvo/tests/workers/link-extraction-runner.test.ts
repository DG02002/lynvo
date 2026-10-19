import { env } from "cloudflare:workers"
import { Effect, Layer, ManagedRuntime } from "effect"
import { describe, expect, it, vi } from "vitest"

import type { ExtractedLink } from "../../app/features/links/types"
import { ExtractionError } from "../../app/lib/effect/errors"
import * as runtimeModule from "../../app/lib/effect/runtime"
import { ExtractionService } from "../../app/lib/effect/services/extraction-service"
import type { ExtractionServiceContract } from "../../app/lib/effect/services/extraction-types"
import {
  EMPTY_LINK_METADATA_JSON,
  LINK_EXTRACTION_MAX_ATTEMPTS,
  LINK_EXTRACTION_TRANSIENT_RETRY_SECONDS,
} from "../../workers/constants"
import { enqueueSavedLinkExtraction } from "../../workers/d1/link-extraction-queue"
import { listSavedLinksWithDataVersion } from "../../workers/d1/links"
import { processSavedLinkExtraction } from "../../workers/link-extraction-runner"
import { createDataChangedRecorder } from "../support/realtime-notifications"
import { createUserFactory } from "../support/worker-fixtures"

const NOW = 1_750_000_000_000

const createUser = createUserFactory(
  env.DB,
  NOW,
  () => "runner-test@example.com"
)

const playableLink: ExtractedLink = {
  nodeKey: "runner:file",
  url: "https://media.example/runner.mp4",
  label: "Runner video",
  type: "file",
  mediaNodeKind: "playable",
}

const enqueueLink = async (userId: string) => {
  const url = `https://source.example/${crypto.randomUUID()}`
  const queued = await enqueueSavedLinkExtraction(env.DB, userId, {
    meta: EMPTY_LINK_METADATA_JSON,
    operationId: `runner:queue:${crypto.randomUUID()}`,
    url,
    title: "Queued extraction",
    now: Date.now(),
  })
  if (!queued.id) {
    throw new Error("Queued extraction did not return a Saved link id")
  }
  return { id: queued.id, url }
}

const withExtraction = async <Result>(
  extract: ExtractionServiceContract["extract"],
  run: () => Promise<Result>
): Promise<Result> => {
  const service = ExtractionService.of({
    extract,
    getMetadata: () => Effect.die(new Error("Unexpected metadata request")),
  })
  const runtime = ManagedRuntime.make(Layer.succeed(ExtractionService, service))
  // SAFETY: The runner's extraction effect is supplied by this test service.
  const getRuntimeSpy = vi
    .spyOn(runtimeModule, "getRuntime")
    .mockReturnValue(runtime as ReturnType<typeof runtimeModule.getRuntime>)
  try {
    return await run()
  } finally {
    getRuntimeSpy.mockRestore()
    await runtime.dispose()
  }
}

const processWithExtraction = (
  linkId: string,
  realtime: DurableObjectNamespace,
  extract: ExtractionServiceContract["extract"]
) =>
  withExtraction(extract, () => {
    // SAFETY: This test uses Miniflare D1 and records the runner's realtime messages.
    const testEnvironment = { ...env, USER_REALTIME_ROOM: realtime } as Env
    return processSavedLinkExtraction(testEnvironment, env.DB, linkId)
  })

const createTestClock = () => {
  let now = Date.now()
  const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => now)
  return {
    advance: (milliseconds: number) => {
      now += milliseconds
    },
    current: () => now,
    restore: () => dateNowSpy.mockRestore(),
  }
}

const countExtractionOperations = async (
  userId: string,
  linkId: string,
  command: string
): Promise<number> => {
  const result = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM link_command_operations WHERE user_id = ?1 AND link_id = ?2 AND command = ?3"
  )
    .bind(userId, linkId, command)
    .first<{ count: number }>()
  return result?.count ?? 0
}

const getExtractionAttemptCount = async (linkId: string): Promise<number> => {
  const result = await env.DB.prepare(
    "SELECT extraction_attempts FROM links WHERE id = ?1"
  )
    .bind(linkId)
    .first<{ extraction_attempts: number }>()
  return result?.extraction_attempts ?? 0
}

describe("link extraction runner", () => {
  it("settles completed links and delivers the final data version", async () => {
    const user = await createUser()
    const queued = await enqueueLink(user.id)
    const recorder = createDataChangedRecorder()

    await expect(
      processWithExtraction(queued.id, recorder.realtime, () =>
        Effect.succeed({ links: [playableLink] })
      )
    ).resolves.toBe(true)

    const snapshot = await listSavedLinksWithDataVersion(
      env.DB,
      user.id,
      Date.now()
    )
    expect(snapshot.results[0]?.extractionState).toBe("complete")
    expect(recorder.deliveries.at(-1)).toEqual({
      userId: user.id,
      version: snapshot.dataVersion,
    })
  })

  it("requeues a pending extraction with its retry delay", async () => {
    const user = await createUser()
    const queued = await enqueueLink(user.id)
    const recorder = createDataChangedRecorder()
    const startedAt = Date.now()

    await expect(
      processWithExtraction(queued.id, recorder.realtime, () =>
        Effect.succeed({ links: [], pending: { retryAfterSeconds: 30 } })
      )
    ).resolves.toBe(true)

    const snapshot = await listSavedLinksWithDataVersion(
      env.DB,
      user.id,
      Date.now()
    )
    const extractionState = await env.DB.prepare(
      "SELECT extraction_attempts, extraction_available_at FROM links WHERE id = ?1"
    )
      .bind(queued.id)
      .first<{
        extraction_attempts: number
        extraction_available_at: number | null
      }>()
    const completedAt = Date.now()
    expect(snapshot.results[0]?.extractionState).toBe("queued")
    expect(extractionState?.extraction_attempts).toBe(1)
    expect(extractionState?.extraction_available_at).toBeGreaterThanOrEqual(
      startedAt + 30_000
    )
    expect(extractionState?.extraction_available_at).toBeLessThanOrEqual(
      completedAt + 30_000
    )
    expect(recorder.deliveries.at(-1)?.userId).toBe(user.id)
  })

  it("marks an empty extraction failed", async () => {
    const user = await createUser()
    const queued = await enqueueLink(user.id)
    const recorder = createDataChangedRecorder()

    await expect(
      processWithExtraction(queued.id, recorder.realtime, () =>
        Effect.succeed({ links: [] })
      )
    ).resolves.toBe(true)

    const snapshot = await listSavedLinksWithDataVersion(
      env.DB,
      user.id,
      Date.now()
    )
    expect(snapshot.results[0]?.extractionState).toBe("failed")
    expect(snapshot.results[0]?.extractionError).toBe(
      "No playable links found. Try a different link."
    )
    expect(recorder.deliveries.at(-1)?.userId).toBe(user.id)
  })

  it("settles an extraction service error as failed", async () => {
    const user = await createUser()
    const queued = await enqueueLink(user.id)
    const recorder = createDataChangedRecorder()
    const extractionError = new ExtractionError({
      message: "UNSUPPORTED_URL",
      url: queued.url,
    })

    await expect(
      processWithExtraction(queued.id, recorder.realtime, () =>
        Effect.fail(extractionError)
      )
    ).resolves.toBe(true)

    const snapshot = await listSavedLinksWithDataVersion(
      env.DB,
      user.id,
      Date.now()
    )
    expect(snapshot.results[0]?.extractionState).toBe("failed")
    await expect(getExtractionAttemptCount(queued.id)).resolves.toBe(1)
    expect(snapshot.results[0]?.extractionError).toBeTruthy()
    expect(recorder.deliveries.at(-1)?.userId).toBe(user.id)
    await expect(
      countExtractionOperations(user.id, queued.id, "link-extraction-pending")
    ).resolves.toBe(0)
    await expect(
      countExtractionOperations(user.id, queued.id, "link-extraction-settle")
    ).resolves.toBe(1)
  })

  it("retries a transient failure and completes on the next attempt", async () => {
    const user = await createUser()
    const queued = await enqueueLink(user.id)
    const recorder = createDataChangedRecorder()
    const clock = createTestClock()
    let attempts = 0
    const extract: ExtractionServiceContract["extract"] = () => {
      attempts += 1
      return attempts === 1
        ? Effect.fail(
            new ExtractionError({
              message: "TEMPORARY_FAILURE",
              url: queued.url,
            })
          )
        : Effect.succeed({ links: [playableLink] })
    }

    try {
      await expect(
        processWithExtraction(queued.id, recorder.realtime, extract)
      ).resolves.toBe(true)

      const requeuedRow = await env.DB.prepare(
        "SELECT extraction_state, extraction_attempts, extraction_available_at FROM links WHERE id = ?1"
      )
        .bind(queued.id)
        .first<{
          extraction_state: string
          extraction_attempts: number
          extraction_available_at: number | null
        }>()
      expect(requeuedRow?.extraction_state).toBe("queued")
      expect(requeuedRow?.extraction_attempts).toBe(1)
      expect(requeuedRow?.extraction_available_at).toBe(
        clock.current() + LINK_EXTRACTION_TRANSIENT_RETRY_SECONDS * 1_000
      )

      clock.advance(LINK_EXTRACTION_TRANSIENT_RETRY_SECONDS * 1_000)
      await expect(
        processWithExtraction(queued.id, recorder.realtime, extract)
      ).resolves.toBe(true)
    } finally {
      clock.restore()
    }

    const snapshot = await listSavedLinksWithDataVersion(
      env.DB,
      user.id,
      Date.now()
    )
    expect(attempts).toBe(2)
    expect(snapshot.results[0]?.extractionState).toBe("complete")
    await expect(getExtractionAttemptCount(queued.id)).resolves.toBe(2)
    expect(recorder.deliveries.at(-1)).toEqual({
      userId: user.id,
      version: snapshot.dataVersion,
    })
    await expect(
      countExtractionOperations(user.id, queued.id, "link-extraction-pending")
    ).resolves.toBe(1)
    await expect(
      countExtractionOperations(user.id, queued.id, "link-extraction-settle")
    ).resolves.toBe(1)
  })

  it("settles a transient failure after the maximum attempts", async () => {
    const user = await createUser()
    const queued = await enqueueLink(user.id)
    const recorder = createDataChangedRecorder()
    const clock = createTestClock()
    const extract: ExtractionServiceContract["extract"] = () =>
      Effect.fail(
        new ExtractionError({
          message: "TEMPORARY_FAILURE",
          url: queued.url,
        })
      )

    try {
      for (
        let attempt = 0;
        attempt < LINK_EXTRACTION_MAX_ATTEMPTS;
        attempt += 1
      ) {
        await expect(
          processWithExtraction(queued.id, recorder.realtime, extract)
        ).resolves.toBe(true)
        clock.advance(LINK_EXTRACTION_TRANSIENT_RETRY_SECONDS * 1_000)
      }
    } finally {
      clock.restore()
    }

    const snapshot = await listSavedLinksWithDataVersion(
      env.DB,
      user.id,
      Date.now()
    )
    expect(snapshot.results[0]?.extractionState).toBe("failed")
    await expect(getExtractionAttemptCount(queued.id)).resolves.toBe(
      LINK_EXTRACTION_MAX_ATTEMPTS
    )
    await expect(
      countExtractionOperations(user.id, queued.id, "link-extraction-pending")
    ).resolves.toBe(LINK_EXTRACTION_MAX_ATTEMPTS - 1)
    await expect(
      countExtractionOperations(user.id, queued.id, "link-extraction-settle")
    ).resolves.toBe(1)
  })
})
