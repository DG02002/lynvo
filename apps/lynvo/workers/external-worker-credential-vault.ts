interface EncryptedExternalWorkerCredential {
  readonly ciphertext: string
  readonly nonce: string
  readonly algorithm: "AES-256-GCM"
  readonly keyVersion: number
}

interface CredentialContext {
  readonly userId: string
  readonly workerId: string
}

type CredentialVaultEnvironment = Partial<
  Pick<Env, "PLUGIN_CREDENTIAL_MASTER_KEY">
>

const ALGORITHM = "AES-256-GCM"
const WEB_CRYPTO_ALGORITHM = "AES-GCM"
const KEY_VERSION = 1
const KEY_LENGTH_BYTES = 32
const NONCE_LENGTH_BYTES = 12
const UNAVAILABLE_RESPONSE = { error: "Credential protection is unavailable." }

const decodeBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const decoded = atob(value)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return bytes
}

const encodeBase64 = (value: ArrayBuffer): string => {
  let encoded = ""
  for (const byte of new Uint8Array(value)) {
    encoded += String.fromCharCode(byte)
  }
  return btoa(encoded)
}

const additionalData = ({ userId, workerId }: CredentialContext) =>
  new TextEncoder().encode(
    `external-worker\u0000${userId}\u0000${workerId}\u0000${KEY_VERSION}`
  )

const isContext = (value: unknown): value is CredentialContext =>
  typeof value === "object" &&
  value !== null &&
  "userId" in value &&
  "workerId" in value &&
  typeof value.userId === "string" &&
  typeof value.workerId === "string" &&
  value.userId.length > 0 &&
  value.workerId.length > 0

const isEncryptedCredential = (
  value: unknown
): value is EncryptedExternalWorkerCredential =>
  typeof value === "object" &&
  value !== null &&
  "ciphertext" in value &&
  "nonce" in value &&
  "algorithm" in value &&
  "keyVersion" in value &&
  typeof value.ciphertext === "string" &&
  typeof value.nonce === "string" &&
  value.algorithm === ALGORITHM &&
  value.keyVersion === KEY_VERSION

const importMasterKey = async (encodedKey: string): Promise<CryptoKey> => {
  const bytes = decodeBase64(encodedKey)
  if (bytes.byteLength !== KEY_LENGTH_BYTES) {
    throw new Error("Invalid credential master key")
  }
  return await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: WEB_CRYPTO_ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  )
}

export class ExternalWorkerCredentialVault implements DurableObject {
  constructor(
    _state: DurableObjectState,
    private readonly environment: CredentialVaultEnvironment
  ) {}

  fetch = async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 })
    }
    const encodedKey = this.environment.PLUGIN_CREDENTIAL_MASTER_KEY
    if (!encodedKey) {
      return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
    }
    let masterKey: CryptoKey
    let payload: unknown
    try {
      masterKey = await importMasterKey(encodedKey)
      payload = await request.json()
    } catch {
      return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
    }
    if (!isContext(payload)) {
      return new Response(null, { status: 400 })
    }
    const pathname = new URL(request.url).pathname
    if (pathname === "/encrypt") {
      if (
        !("apiKey" in payload) ||
        typeof payload.apiKey !== "string" ||
        payload.apiKey.length === 0
      ) {
        return new Response(null, { status: 400 })
      }
      const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH_BYTES))
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: WEB_CRYPTO_ALGORITHM,
          iv: nonce,
          additionalData: additionalData(payload),
        },
        masterKey,
        new TextEncoder().encode(payload.apiKey)
      )
      return Response.json({
        ciphertext: encodeBase64(ciphertext),
        nonce: encodeBase64(nonce.buffer),
        algorithm: ALGORITHM,
        keyVersion: KEY_VERSION,
      } satisfies EncryptedExternalWorkerCredential)
    }
    if (pathname === "/decrypt") {
      if (
        !("credential" in payload) ||
        !isEncryptedCredential(payload.credential)
      ) {
        return new Response(null, { status: 400 })
      }
      try {
        const plaintext = await crypto.subtle.decrypt(
          {
            name: WEB_CRYPTO_ALGORITHM,
            iv: decodeBase64(payload.credential.nonce),
            additionalData: additionalData(payload),
          },
          masterKey,
          decodeBase64(payload.credential.ciphertext)
        )
        return Response.json({ apiKey: new TextDecoder().decode(plaintext) })
      } catch {
        return new Response(null, { status: 422 })
      }
    }
    return new Response(null, { status: 404 })
  }
}
