# HttpOnly session migration boundary

## Boundary

The Cloudflare Worker becomes the only browser-facing authentication boundary.
The browser receives an opaque session cookie; Convex access and refresh
credentials remain server-side and are never returned by rendered routes or API
responses.

## Widen

1. [ ] Add a versioned Worker session Durable Object storing encrypted Convex token
   state, idle expiry, absolute expiry, rotation state, and revocation state.
   Encrypted server-side storage, absolute and sliding idle expiry, and
   revocation are implemented; token rotation and the browser-facing cutover
   remain.
2. Add parallel Worker sign-in, refresh, session-read, and logout endpoints using
   `HttpOnly; Secure; SameSite=Lax; Path=/` cookies.
   Sign-in dual-issuance, Worker session reads, logout, revocation propagation,
   and a token-rotating refresh endpoint are implemented. Automatic refresh is
   intentionally deferred until legacy browser refresh-token consumers are
   removed so two clients cannot race the same rotation family.
3. Keep the current browser-token path available while behavioral parity is
   verified; do not silently sign users out.
   The legacy path remains because authenticated Convex subscriptions have not
   all moved behind the Worker boundary yet.

## Migrate

1. Prefer the Worker session during SSR and same-origin API requests.
2. On a valid legacy browser session, exchange it once into the opaque Worker
   session and clear browser-readable refresh state.
3. Verify sign-in, SSR, API authentication, rotation, logout, and revocation at
   the approved Worker HTTP and rendered-route seams.

## Narrow

1. Remove refresh credentials from browser storage and responses.
2. Remove legacy cookie/local-storage readers after the compatibility window.
3. [x] Replace inline/eval CSP allowances with nonce or hash-based scripts.
   Production documents now generate a per-response nonce for React streaming
   and React Router scripts, and authorize the constant theme bootstrap by its
   SHA-256 hash. Development retains the allowances required by the Vite dev
   runtime. Live browser hydration verification remains an external check.

## External requirements

- A production encryption/session key supplied only through Worker secrets.
- Live browser verification against `https://lynvo.dg02002.workers.dev` before
  narrowing.
