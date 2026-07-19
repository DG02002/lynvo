import { createCookie } from "react-router"

const isProd = import.meta.env.PROD

export const sessionCookie = createCookie(
  isProd ? "__Host-session" : "session",
  {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  }
)
