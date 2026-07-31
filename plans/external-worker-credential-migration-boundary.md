# External-worker credential encryption migration boundary

## Boundary

External-worker credentials remain owned by the authenticated user. Convex may
store only versioned ciphertext; only the Lynvo Worker may decrypt a credential
for an authenticated extraction request bound to the same user and worker.

## Widen

1. [x] Add optional ciphertext, nonce, algorithm, and key-version fields while
   retaining the legacy plaintext field.
2. [x] Introduce an internal Worker encryption boundary using AES-256-GCM with the user id and
   worker id as additional authenticated data.
3. [x] Write new registrations in encrypted form and keep reads compatible with
   both shapes.

New registration creates a credential-free pending row, encrypts against the
final user/worker identity, finalizes versioned ciphertext, and removes the
pending row if encryption or finalization fails. Worker-only service reads
decrypt ciphertext and retain the legacy plaintext compatibility reader until
the restartable migration is verified.

## Migrate

The operator confirmed that both databases are disposable and contain no real
user data, so legacy-row encryption is replaced by an explicit reset boundary:

1. [ ] Delete all `userWorkers` rows in the local/development and production
   Convex deployments before applying the narrowed schema.
2. [ ] Verify both deployments report zero legacy rows without printing row
   contents.
3. [x] Verify copied ciphertext fails for another user or worker context.

## Narrow

1. [x] Reject plaintext writes.
2. [ ] Verify every deployed row has the encrypted shape; the approved reset
   makes this a zero-row pre-deployment check.
3. [x] Remove the plaintext schema field and compatibility reader.
4. [x] Ensure browser queries never expose plaintext or decrypted credentials.

## External requirements

- A versioned production master key supplied only through Worker secrets.
- Confirmation that external-worker registration ships in v1 before narrowing.
