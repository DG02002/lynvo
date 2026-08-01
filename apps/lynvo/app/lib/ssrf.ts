import { validateOutboundUrl } from "./outbound-http"

export const isSafeUrl = (url: string): boolean => {
  try {
    validateOutboundUrl(url)
    return true
  } catch {
    return false
  }
}
