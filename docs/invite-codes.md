# Invite Code Management

This system uses an invite code mechanism to restrict signups. Only users with a valid, unused invite code can create an account.

## 1. Configuration

The invite generation endpoint is protected by an `ADMIN_SECRET`.

### Local Development

The secret is stored in `.dev.vars`:

```env
ADMIN_SECRET="replace-with-a-random-secret"
```

Do not use both files at once in the same project root.

### Production

To set the secret in production (Cloudflare Workers), run:

```bash
npx wrangler secret put ADMIN_SECRET
```

When prompted, paste the secret value (e.g., the one generated above or a new secure string).

## 2. Generating an Invite Code

To generate a new invite code, send a POST request to the `/api/admin/invite` endpoint with the `x-admin-secret` header.

### Using cURL (Local)

```bash
curl -X POST http://localhost:5180/api/admin/invite \
  -H "x-admin-secret: replace-with-your-admin-secret"
```

### Using cURL (Production)

Replace `https://your-app.workers.dev` with your actual deployed URL.

```bash
curl -X POST https://lynvo.example/api/admin/invite \
  -H "x-admin-secret: replace-with-your-admin-secret"
```

### Response

The API will return a JSON object with the new code:

```json
{
  "code": "A1B2C3D4"
}
```

## 3. Usage

Share this code with the user you want to invite. They will need to enter it in the "Invite Code" field on the signup page.

- Each code is valid for **one use only**.
- Once used, the code is marked as `is_used=1` in the database and linked to the user who used it.
