import {
  SEALED_RECORD_ALGORITHM,
  SEALED_RECORD_KEY_LENGTH_BYTES,
  SEALED_RECORD_KEY_VERSION,
  SEALED_RECORD_NONCE_LENGTH_BYTES,
  SEALED_RECORD_WEB_CRYPTO_ALGORITHM,
} from "./constants"
import { z } from "zod"

export interface SealedRecord {
  readonly ciphertext: string
  readonly nonce: string
  readonly algorithm: typeof SEALED_RECORD_ALGORITHM
  readonly keyVersion: number
}

export interface SealRecordOptions {
  encodedKey: string
  additionalData: Uint8Array<ArrayBuffer>
  plaintext: Uint8Array<ArrayBuffer>
}

export interface UnsealRecordOptions {
  encodedKey: string
  additionalData: Uint8Array<ArrayBuffer>
  record: SealedRecord
}

const sealedRecordSchema = z.object({
  ciphertext: z.string(),
  nonce: z.string(),
  algorithm: z.literal(SEALED_RECORD_ALGORITHM),
  keyVersion: z.literal(SEALED_RECORD_KEY_VERSION),
})

export const decodeSealedRecordBase64 = (
  value: string
): Uint8Array<ArrayBuffer> => {
  const decodedValue = atob(value)
  const bytes = new Uint8Array(decodedValue.length)
  for (let index = 0; index < decodedValue.length; index += 1) {
    bytes[index] = decodedValue.charCodeAt(index)
  }
  return bytes
}

const encodeBase64 = (value: ArrayBuffer): string => {
  let binaryValue = ""
  for (const byte of new Uint8Array(value)) {
    binaryValue += String.fromCharCode(byte)
  }
  return btoa(binaryValue)
}

const importEncryptionKey = async (encodedKey: string): Promise<CryptoKey> => {
  const keyBytes = decodeSealedRecordBase64(encodedKey)
  if (keyBytes.byteLength !== SEALED_RECORD_KEY_LENGTH_BYTES) {
    throw new Error("Sealed-record encryption key must contain 32 bytes")
  }
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: SEALED_RECORD_WEB_CRYPTO_ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  )
}

export const isSealedRecord = <Value>(
  value: Value
): value is Value & SealedRecord => sealedRecordSchema.safeParse(value).success

export const sealRecord = async ({
  encodedKey,
  additionalData,
  plaintext,
}: SealRecordOptions): Promise<SealedRecord> => {
  const encryptionKey = await importEncryptionKey(encodedKey)
  const nonce = crypto.getRandomValues(
    new Uint8Array(SEALED_RECORD_NONCE_LENGTH_BYTES)
  )
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: SEALED_RECORD_WEB_CRYPTO_ALGORITHM,
      iv: nonce,
      additionalData,
    },
    encryptionKey,
    plaintext
  )
  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce.buffer),
    algorithm: SEALED_RECORD_ALGORITHM,
    keyVersion: SEALED_RECORD_KEY_VERSION,
  }
}

export const unsealRecord = async ({
  encodedKey,
  additionalData,
  record,
}: UnsealRecordOptions): Promise<ArrayBuffer> => {
  if (!isSealedRecord(record)) {
    throw new Error("Unsupported sealed-record encryption version")
  }
  const encryptionKey = await importEncryptionKey(encodedKey)
  return await crypto.subtle.decrypt(
    {
      name: SEALED_RECORD_WEB_CRYPTO_ALGORITHM,
      iv: decodeSealedRecordBase64(record.nonce),
      additionalData,
    },
    encryptionKey,
    decodeSealedRecordBase64(record.ciphertext)
  )
}
