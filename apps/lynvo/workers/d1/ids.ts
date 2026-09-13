import { toBase64Url } from "../base64-url"

const ID_BYTES = 16

export const createOpaqueId = (): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(ID_BYTES)))
