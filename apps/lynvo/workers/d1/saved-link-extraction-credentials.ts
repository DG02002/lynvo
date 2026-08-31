import type { HttpBasicAuth } from "@dg02002/lynvo-plugin-server-protocol"
import {
  sealRecord,
  unsealRecord,
  type SealedRecord,
} from "../../app/lib/security/sealed-record"
import { SEALED_RECORD_KEY_VERSION } from "../../app/lib/security/constants"
import {
  parseHttpBasicCredential,
  serializeHttpBasicCredential,
} from "../../app/lib/plugins/http-basic-credential"

export interface EncryptedSavedLinkExtractionCredential extends SealedRecord {}

export interface SavedLinkExtractionCredentialRow {
  readonly link_id: string
  readonly user_id: string
  readonly target_url: string
  readonly ciphertext: string
  readonly nonce: string
  readonly algorithm: "AES-256-GCM"
  readonly key_version: number
  readonly created_at: number
  readonly updated_at: number
}

export interface SavedLinkExtractionCredentialWrite {
  readonly targetUrl: string
  readonly record: EncryptedSavedLinkExtractionCredential
  readonly now: number
}

export interface SavedLinkExtractionCredentialLinkState {
  readonly url: string
  readonly extractionState: "queued" | "running" | "complete" | "failed"
  readonly extractionAttempts: number
  readonly extractionLeaseExpiresAt: number | null
  readonly updatedAt: number
  readonly metaJson: string
}

interface SavedLinkCredentialEncryptionEnvironment {
  readonly PLUGIN_CREDENTIAL_ENCRYPTION_KEY: string
}

export interface SavedLinkExtractionCredentialMutationInput {
  readonly database: D1Database
  readonly userId: string
  readonly linkId: string
  readonly operationId: string
  readonly targetUrl: string
  readonly expectedLink: SavedLinkExtractionCredentialLinkState
}

const SAVED_LINK_EXTRACTION_CREDENTIAL_COLUMNS =
  "link_id, user_id, target_url, ciphertext, nonce, algorithm, key_version, created_at, updated_at"

const createSavedLinkExtractionCredentialAdditionalData = (
  userId: string,
  targetUrl: string
): Uint8Array<ArrayBuffer> =>
  new TextEncoder().encode(
    `saved-link-extraction\u0000v${SEALED_RECORD_KEY_VERSION}\u0000${userId}\u0000${targetUrl}`
  )

export const encryptSavedLinkExtractionCredential = async (
  environment: SavedLinkCredentialEncryptionEnvironment,
  input: {
    readonly userId: string
    readonly targetUrl: string
    readonly basicAuth: HttpBasicAuth
  }
): Promise<EncryptedSavedLinkExtractionCredential> => {
  if (!environment.PLUGIN_CREDENTIAL_ENCRYPTION_KEY) {
    throw new Error("Saved link credential protection is unavailable.")
  }
  return await sealRecord({
    encodedKey: environment.PLUGIN_CREDENTIAL_ENCRYPTION_KEY,
    additionalData: createSavedLinkExtractionCredentialAdditionalData(
      input.userId,
      input.targetUrl
    ),
    plaintext: new TextEncoder().encode(
      serializeHttpBasicCredential(
        input.basicAuth.username,
        input.basicAuth.password
      )
    ),
  })
}

export const getSavedLinkExtractionCredential = async (
  database: D1Database,
  userId: string,
  linkId: string
): Promise<SavedLinkExtractionCredentialRow | null> => {
  const row = await database
    .prepare(
      `SELECT ${SAVED_LINK_EXTRACTION_CREDENTIAL_COLUMNS} FROM saved_link_extraction_credentials WHERE user_id = ?1 AND link_id = ?2`
    )
    .bind(userId, linkId)
    .first<SavedLinkExtractionCredentialRow>()
  return row ?? null
}

export const decryptSavedLinkExtractionCredential = async (
  environment: SavedLinkCredentialEncryptionEnvironment,
  row: SavedLinkExtractionCredentialRow,
  input: { readonly userId: string; readonly targetUrl: string }
): Promise<HttpBasicAuth> => {
  if (!environment.PLUGIN_CREDENTIAL_ENCRYPTION_KEY) {
    throw new Error("Saved link credential protection is unavailable.")
  }
  const plaintext = await unsealRecord({
    encodedKey: environment.PLUGIN_CREDENTIAL_ENCRYPTION_KEY,
    additionalData: createSavedLinkExtractionCredentialAdditionalData(
      input.userId,
      input.targetUrl
    ),
    record: {
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      algorithm: row.algorithm,
      keyVersion: row.key_version,
    },
  })
  return parseHttpBasicCredential(new TextDecoder().decode(plaintext))
}

export const createUpsertSavedLinkExtractionCredentialStatement = (
  input: SavedLinkExtractionCredentialMutationInput & {
    readonly credential: SavedLinkExtractionCredentialWrite
  }
): D1PreparedStatement => {
  const { database, userId, linkId, targetUrl, expectedLink, credential } =
    input
  return database
    .prepare(
      `INSERT INTO saved_link_extraction_credentials (link_id, user_id, target_url, ciphertext, nonce, algorithm, key_version, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
       WHERE EXISTS (
         SELECT 1 FROM links
         WHERE id = ?1
           AND user_id = ?2
           AND url = ?3
           AND extraction_state = ?10
           AND extraction_attempts = ?11
           AND updated_at = ?12
           AND ((?13 IS NULL AND extraction_lease_expires_at IS NULL) OR extraction_lease_expires_at = ?13)
           AND meta_json IS ?14
           AND EXISTS (
             SELECT 1 FROM link_command_operations
             WHERE user_id = ?2 AND operation_id = ?15 AND link_id = ?1
           )
       )
       ON CONFLICT(link_id) DO UPDATE SET user_id = excluded.user_id, target_url = excluded.target_url, ciphertext = excluded.ciphertext, nonce = excluded.nonce, algorithm = excluded.algorithm, key_version = excluded.key_version, updated_at = excluded.updated_at`
    )
    .bind(
      linkId,
      userId,
      targetUrl,
      credential.record.ciphertext,
      credential.record.nonce,
      credential.record.algorithm,
      credential.record.keyVersion,
      credential.now,
      credential.now,
      expectedLink.extractionState,
      expectedLink.extractionAttempts,
      expectedLink.updatedAt,
      expectedLink.extractionLeaseExpiresAt,
      expectedLink.metaJson,
      input.operationId
    )
}

export const createConditionalDeleteSavedLinkExtractionCredentialStatement = (
  input: SavedLinkExtractionCredentialMutationInput
): D1PreparedStatement => {
  const { database, userId, linkId, targetUrl, expectedLink } = input
  return database
    .prepare(
      `DELETE FROM saved_link_extraction_credentials
       WHERE link_id = ?1
         AND user_id = ?2
         AND EXISTS (
           SELECT 1 FROM links
           WHERE id = ?1
             AND user_id = ?2
             AND url = ?3
             AND extraction_state = ?4
             AND extraction_attempts = ?5
             AND updated_at = ?6
           AND ((?7 IS NULL AND extraction_lease_expires_at IS NULL) OR extraction_lease_expires_at = ?7)
           AND meta_json IS ?8
           AND EXISTS (
             SELECT 1 FROM link_command_operations
             WHERE user_id = ?2 AND operation_id = ?9 AND link_id = ?1
           )
         )`
    )
    .bind(
      linkId,
      userId,
      targetUrl,
      expectedLink.extractionState,
      expectedLink.extractionAttempts,
      expectedLink.updatedAt,
      expectedLink.extractionLeaseExpiresAt,
      expectedLink.metaJson,
      input.operationId
    )
}
