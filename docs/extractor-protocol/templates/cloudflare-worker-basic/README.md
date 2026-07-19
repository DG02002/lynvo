# Cloudflare Worker Extractor Template

This is a minimal external extractor shape. It is not Lynvo application code.
Copy it into a separate extractor repository and replace the example source with
your own plugin logic.

## Files

- `package.json` - dependencies and local commands.
- `wrangler.json` - Cloudflare Worker config with static WebP assets.
- `src/index.ts` - manifest, auth, and extract handlers.
- `public/icons/plugins/example.webp` - replace with your plugin icon.

## Commands

```bash
pnpm install
pnpm dev
pnpm test:contract
pnpm deploy
```

The manifest is the contract Lynvo reads. Keep source ids stable, use direct
HTTPS WebP icon URLs after deployment, and update source `status` / `version`
when plugin behavior changes.
