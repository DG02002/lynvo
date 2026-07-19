import type { RegisteredWorker } from "./extractor-types"

export const WORKER_VERIFICATION_STATUS = {
  down: "down",
  verified: "verified",
} as const

export const isWorkerUsable = (
  worker: Pick<RegisteredWorker, "enabled" | "verificationStatus">
): boolean =>
  worker.enabled &&
  worker.verificationStatus === WORKER_VERIFICATION_STATUS.verified
