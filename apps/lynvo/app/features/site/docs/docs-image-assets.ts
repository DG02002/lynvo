export type DocumentationImageExtension = "png" | "webp"

const documentationImageModules = import.meta.glob<string>(
  "./images/*.{png,webp}",
  { eager: true, import: "default", query: "?url" }
)

export const getDocumentationImageAsset = (
  name: string,
  imageModules: Readonly<Record<string, string>> = documentationImageModules
) => {
  for (const extension of ["png", "webp"] as const) {
    const source = imageModules[`./images/${name}.${extension}`]
    if (source) {
      return { extension, source }
    }
  }

  return undefined
}

export const getDocumentationImageExtension = (name: string) =>
  getDocumentationImageAsset(name)?.extension
