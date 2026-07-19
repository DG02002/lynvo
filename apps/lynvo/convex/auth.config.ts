import type { AuthConfig } from "convex/server"

declare const process: {
  env: {
    CONVEX_SITE_URL?: string
  }
}

export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig
