export interface StorageRejection {
  readonly kind: "storage-limit" | "link-too-large"
  readonly sizeBytes?: number
  readonly usedBytes?: number
  readonly limitBytes: number
}

export const LINK_NOT_FOUND_MESSAGE = "Link not found or no longer available"
export const PLUGIN_DOMAIN_NOT_FOUND_MESSAGE = "Plugin domain not found"
export const PLUGIN_SERVER_NOT_FOUND_MESSAGE =
  "Plugin server not found or no longer available"

export class StorageLimitError extends Error {
  readonly kind = "storage-limit" as const
  readonly usedBytes: number
  readonly limitBytes: number

  constructor(usedBytes: number, limitBytes: number) {
    super("Storage limit reached")
    this.name = "StorageLimitError"
    this.usedBytes = usedBytes
    this.limitBytes = limitBytes
  }

  get rejection(): StorageRejection {
    return {
      kind: this.kind,
      usedBytes: this.usedBytes,
      limitBytes: this.limitBytes,
    }
  }
}

export class LinkTooLargeError extends Error {
  readonly kind = "link-too-large" as const
  readonly sizeBytes: number
  readonly limitBytes: number

  constructor(sizeBytes: number, limitBytes: number) {
    super("Saved link is too large")
    this.name = "LinkTooLargeError"
    this.sizeBytes = sizeBytes
    this.limitBytes = limitBytes
  }

  get rejection(): StorageRejection {
    return {
      kind: this.kind,
      sizeBytes: this.sizeBytes,
      limitBytes: this.limitBytes,
    }
  }
}
