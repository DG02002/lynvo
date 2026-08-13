import type { RouterContextProvider } from "react-router"
import { cloudflareContext } from "./router-context"

export const getServerEnv = (context: Readonly<RouterContextProvider>): Env => {
  return context.get(cloudflareContext).env
}
