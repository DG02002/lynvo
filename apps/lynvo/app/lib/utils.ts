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
