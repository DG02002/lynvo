import { describe, expect, it } from "vitest"
import {
  createGoogleSignInStart,
  decryptStatePayload,
  encryptStatePayload,
  normalizeGoogleReturnTo,
  parseVerifiedGoogleProfile,
} from "../../workers/d1/google-auth"

const CLIENT_SECRET = "test-client-secret"
const CLIENT_ID = "test-client-id"
const NOW = 1_750_000_000_000

const encodeIdToken = (claims: Record<string, unknown>): string => {
  const encodePart = (value: object) =>
    btoa(JSON.stringify(value))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "")
  return `${encodePart({ alg: "RS256", typ: "JWT" })}.${encodePart(claims)}.signature`
}

describe("google oauth state cookie", () => {
  it("round-trips an encrypted state payload", async () => {
    const payload = {
      state: "state-value",
      codeVerifier: "verifier-value",
      returnTo: "/save",
      expiresAt: NOW + 600_000,
    }
    const encrypted = await encryptStatePayload(payload, CLIENT_SECRET)
    const decrypted = await decryptStatePayload(encrypted, CLIENT_SECRET)
    expect(decrypted).toEqual(payload)
  })

  it("rejects a tampered or wrongly-keyed state payload", async () => {
    const encrypted = await encryptStatePayload(
      {
        state: "state-value",
        codeVerifier: "verifier-value",
        returnTo: "/",
        expiresAt: NOW,
      },
      CLIENT_SECRET
    )
    expect(await decryptStatePayload(`${encrypted}x`, CLIENT_SECRET)).toBeNull()
    expect(await decryptStatePayload(encrypted, "other-secret")).toBeNull()
    expect(await decryptStatePayload("not-a-payload", CLIENT_SECRET)).toBeNull()
  })

  it("starts a sign-in with PKCE and a state cookie", async () => {
    const { redirectUrl, stateCookie } = await createGoogleSignInStart({
      credentials: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
      origin: "https://lynvo.example",
      returnTo: "/save",
      now: NOW,
    })
    const url = new URL(redirectUrl)
    expect(url.origin).toBe("https://accounts.google.com")
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID)
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://lynvo.example/api/auth/callback/google"
    )
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("code_challenge")).toBeTruthy()
    expect(stateCookie).toContain("HttpOnly")
    expect(stateCookie).toContain("SameSite=Lax")

    const stateCookieValue = stateCookie.split(";")[0].split("=")[1]
    const decrypted = await decryptStatePayload(
      decodeURIComponent(stateCookieValue),
      CLIENT_SECRET
    )
    expect(decrypted?.state).toBe(url.searchParams.get("state"))
    expect(decrypted?.returnTo).toBe("/save")
  })

  it("normalizes return-to paths to same-origin relative routes", () => {
    expect(normalizeGoogleReturnTo("/save")).toBe("/save")
    expect(normalizeGoogleReturnTo(undefined)).toBe("/")
    expect(normalizeGoogleReturnTo("//evil.example")).toBe("/")
    expect(normalizeGoogleReturnTo("https://evil.example")).toBe("/")
  })
})

describe("google id token validation", () => {
  const baseClaims = {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: NOW / 1000 + 3_600,
    sub: "google-subject-1",
    email: "user@example.com",
    email_verified: true,
    name: "Test User",
    picture: "https://example.com/picture.png",
  }

  it("accepts a valid verified token", () => {
    const profile = parseVerifiedGoogleProfile(
      encodeIdToken(baseClaims),
      { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
      NOW
    )
    expect(profile).toEqual({
      subject: "google-subject-1",
      email: "user@example.com",
      displayName: "Test User",
      avatarUrl: "https://example.com/picture.png",
    })
  })

  it("rejects unverified emails, wrong audiences, expired tokens, and bad issuers", () => {
    const cases = [
      { ...baseClaims, email_verified: false },
      { ...baseClaims, aud: "other-client-id" },
      { ...baseClaims, exp: NOW / 1000 - 1 },
      { ...baseClaims, iss: "https://evil.example" },
    ]
    for (const claims of cases) {
      expect(
        parseVerifiedGoogleProfile(
          encodeIdToken(claims),
          { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
          NOW
        )
      ).toBeNull()
    }
  })

  it("rejects malformed tokens", () => {
    expect(
      parseVerifiedGoogleProfile(
        "not-a-jwt",
        { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
        NOW
      )
    ).toBeNull()
    expect(
      parseVerifiedGoogleProfile(
        "a.b.c",
        { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
        NOW
      )
    ).toBeNull()
  })
})
