const encoder = new TextEncoder()

const ITERATIONS = 600_000
const SALT_BYTES = 16
const KEY_BITS = 256

const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

const base64UrlDecode = (value: string): Uint8Array => {
  const padded = value.padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "="
  )
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const derive = async (
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> => {
  const saltBuffer = new ArrayBuffer(salt.length)
  new Uint8Array(saltBuffer).set(salt)
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBuffer,
      iterations,
    },
    key,
    KEY_BITS
  )
  return new Uint8Array(bits)
}

export const hashPasswordSecret = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2-sha256.${ITERATIONS}.${base64UrlEncode(salt)}.${base64UrlEncode(hash)}`
}

export const verifyPasswordSecret = async (
  password: string,
  stored: string
): Promise<boolean> => {
  const [algorithm, iterationsValue, saltValue, hashValue] = stored.split(".")
  if (
    algorithm !== "pbkdf2-sha256" ||
    !iterationsValue ||
    !saltValue ||
    !hashValue
  ) {
    return false
  }
  const iterations = Number(iterationsValue)
  if (!Number.isInteger(iterations) || iterations < 100_000) {
    return false
  }
  const salt = base64UrlDecode(saltValue)
  const expected = base64UrlDecode(hashValue)
  const actual = await derive(password, salt, iterations)
  if (actual.length !== expected.length) {
    return false
  }
  let diff = 0
  for (let index = 0; index < actual.length; index += 1) {
    diff |= actual[index] ^ expected[index]
  }
  return diff === 0
}
