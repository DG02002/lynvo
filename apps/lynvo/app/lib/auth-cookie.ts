import { Schema } from "effect"

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const AuthTransaction = Schema.Struct({
  codeVerifier: Schema.String,
  state: Schema.String,
  returnTo: Schema.String,
})

export interface AuthTransactionData extends Schema.Schema.Type<
  typeof AuthTransaction
> {}

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

const fromBase64Url = (value: string): Uint8Array => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const encryptionKey = async (password: string): Promise<CryptoKey> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(password)
  )
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ])
}

export const encryptAuthTransaction = async (
  transaction: AuthTransactionData,
  password: string
): Promise<string> => {
  const initializationVector = crypto.getRandomValues(new Uint8Array(12))
  const key = await encryptionKey(password)
  const plaintext = textEncoder.encode(JSON.stringify(transaction))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: initializationVector },
      key,
      plaintext
    )
  )
  const value = new Uint8Array(initializationVector.length + ciphertext.length)
  value.set(initializationVector)
  value.set(ciphertext, initializationVector.length)
  return toBase64Url(value)
}

export const decryptAuthTransaction = async (
  value: string,
  password: string
): Promise<AuthTransactionData> => {
  const encrypted = fromBase64Url(value)
  const initializationVector = encrypted.slice(0, 12)
  const ciphertext = encrypted.slice(12)
  const key = await encryptionKey(password)
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: initializationVector },
    key,
    ciphertext
  )
  return Schema.decodeUnknownSync(AuthTransaction)(
    JSON.parse(textDecoder.decode(plaintext))
  )
}

export const getCookieValue = (
  request: Request,
  cookieName: string
): string | undefined => {
  const cookieHeader = request.headers.get("Cookie") ?? ""
  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=")
    if (separatorIndex < 0) {
      continue
    }
    const name = cookie.slice(0, separatorIndex).trim()
    if (name === cookieName) {
      return decodeURIComponent(cookie.slice(separatorIndex + 1))
    }
  }
  return undefined
}

export const normalizeReturnTo = (value: string | undefined): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/"
  }
  return value
}
