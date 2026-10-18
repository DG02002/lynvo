export interface SealedProxyProviderCredential {
  readonly ciphertext: string
  readonly nonce: string
  readonly algorithm: "AES-256-GCM"
  readonly version: number
}

export interface StoredProxyProviderCredential extends SealedProxyProviderCredential {
  readonly legacyPluginServerId?: string
}
