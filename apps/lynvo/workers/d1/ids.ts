const ID_BYTES = 16

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

export const createOpaqueId = (): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(ID_BYTES)))
