import type { SealedRecord } from "../app/lib/security/sealed-record"
import {
  isSealedRecord,
  sealRecord,
  unsealRecord,
} from "../app/lib/security/sealed-record"
import { SEALED_RECORD_KEY_VERSION } from "../app/lib/security/constants"

interface EncryptedPluginServerCredential extends SealedRecord {}

interface CredentialContext {
  readonly userId: string
  readonly pluginServerId: string
}

type CredentialVaultEnvironment = Partial<
  Pick<Env, "PLUGIN_CREDENTIAL_ENCRYPTION_KEY">
>

const UNAVAILABLE_RESPONSE = { error: "Credential protection is unavailable." }

const additionalData = ({ userId, pluginServerId }: CredentialContext) =>
  new TextEncoder().encode(
    `plugin-server\u0000v${SEALED_RECORD_KEY_VERSION}\u0000${userId}\u0000${pluginServerId}`
  )

const isContext = (value: unknown): value is CredentialContext =>
  typeof value === "object" &&
  value !== null &&
  "userId" in value &&
  "pluginServerId" in value &&
  typeof value.userId === "string" &&
  typeof value.pluginServerId === "string" &&
  value.userId.length > 0 &&
  value.pluginServerId.length > 0

export class PluginServerCredentialVault implements DurableObject {
  constructor(
    _state: DurableObjectState,
    private readonly environment: CredentialVaultEnvironment
  ) {}

  fetch = async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 })
    }
    const encodedKey = this.environment.PLUGIN_CREDENTIAL_ENCRYPTION_KEY
    if (!encodedKey) {
      return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
    }
    let payload: unknown
    try {
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
      try {
        const credential = await sealRecord({
          encodedKey,
          additionalData: additionalData(payload),
          plaintext: new TextEncoder().encode(payload.apiKey),
        })
        return Response.json(
          credential satisfies EncryptedPluginServerCredential
        )
      } catch {
        return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
      }
    }
    if (pathname === "/decrypt") {
      if (!("credential" in payload) || !isSealedRecord(payload.credential)) {
        return new Response(null, { status: 400 })
      }
      try {
        const plaintext = await unsealRecord({
          encodedKey,
          additionalData: additionalData(payload),
          record: payload.credential,
        })
        return Response.json({ apiKey: new TextDecoder().decode(plaintext) })
      } catch {
        return new Response(null, { status: 422 })
      }
    }
    return new Response(null, { status: 404 })
  }
}
