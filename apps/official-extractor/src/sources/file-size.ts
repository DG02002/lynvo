import { BYTES_PER_KIBIBYTE, FILE_SIZE_DECIMAL_PLACES } from "../constants"

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"]

export const formatFileSize = (size?: string | number): string | undefined => {
  if (size === undefined || size === "") {
    return undefined
  }
  let value = Number(size)
  if (!Number.isFinite(value) || value < 0) {
    return undefined
  }
  let unitIndex = 0
  while (
    value >= BYTES_PER_KIBIBYTE &&
    unitIndex < FILE_SIZE_UNITS.length - 1
  ) {
    value /= BYTES_PER_KIBIBYTE
    unitIndex += 1
  }
  const formattedValue =
    unitIndex === 0
      ? String(value)
      : value
          .toFixed(FILE_SIZE_DECIMAL_PLACES)
          .replace(/\.0+$|(?<=\.[0-9])0+$/, "")
  return `${formattedValue} ${FILE_SIZE_UNITS[unitIndex]}`
}
