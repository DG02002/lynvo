import type { RouterContextProvider } from "react-router"
import { cloudflareContext } from "./router-context"

export const getServerEnv = (context: Readonly<RouterContextProvider>): Env => {
  try {
    return context.get(cloudflareContext).env
  } catch {
    return process.env as unknown as Env
  }
}
