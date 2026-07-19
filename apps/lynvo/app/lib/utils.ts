import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCsrfToken() {
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="csrf-token"]')
    if (meta) {
      return meta.getAttribute("content") || ""
    }
  }
  return ""
}

export function getDeviceName(userAgentStr?: string) {
  let ua = ""
  if (userAgentStr) {
    ua = userAgentStr
  } else if (typeof navigator !== "undefined") {
    ua = navigator.userAgent
  }

  if (ua.includes("iPhone")) {
    return "iPhone"
  }
  if (ua.includes("iPad")) {
    return "iPad"
  }
  if (ua.includes("Mac OS")) {
    return "Mac"
  }
  if (ua.includes("Windows")) {
    return "Windows PC"
  }
  if (ua.includes("Android")) {
    return "Android Device"
  }
  if (ua.includes("Linux")) {
    return "Linux PC"
  }
  return "Unknown Device"
}
