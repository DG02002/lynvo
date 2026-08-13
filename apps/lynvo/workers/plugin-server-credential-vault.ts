import type { SealedRecord } from "../app/lib/security/sealed-record"
import {
  isSealedRecord,
  sealRecord,
  unsealRecord,
} from "../app/lib/security/sealed-record"
import { SEALED_RECORD_KEY_VERSION } from "../app/lib/security/constants"
import { z } from "zod"

interface EncryptedPluginServerCredential extends SealedRecord {}

interface CredentialContext {
  readonly userId: string
  readonly pluginServerId: string
}

type CredentialVaultEnvironment = Partial<
  Pick<Env, "PLUGIN_CREDENTIAL_ENCRYPTION_KEY">
>

const UNAVAILABLE_RESPONSE = { error: "Credential protection is unavailable." }
const credentialContextSchema = z.object({
  userId: z.string().min(1),
  pluginServerId: z.string().min(1),
})
const encryptCredentialPayloadSchema = credentialContextSchema.extend({
  apiKey: z.string().min(1),
})

const additionalData = ({ userId, pluginServerId }: CredentialContext) =>
  new TextEncoder().encode(
    `plugin-server\u0000v${SEALED_RECORD_KEY_VERSION}\u0000${userId}\u0000${pluginServerId}`
  )

const isContext = <Value>(value: Value): value is Value & CredentialContext =>
  credentialContextSchema.safeParse(value).success

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
      const encryptPayload = encryptCredentialPayloadSchema.safeParse(payload)
      if (!encryptPayload.success) {
        return new Response(null, { status: 400 })
      }
      try {
        const credential = await sealRecord({
          encodedKey,
          additionalData: additionalData(encryptPayload.data),
          plaintext: new TextEncoder().encode(encryptPayload.data.apiKey),
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
