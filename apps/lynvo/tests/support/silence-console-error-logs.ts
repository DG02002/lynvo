import { vi } from "vitest"

// The hook console.errors failed loads; keep test output clean.
export const silenceConsoleErrorLogs = (): void => {
  vi.spyOn(console, "error").mockImplementation(() => {})
}
