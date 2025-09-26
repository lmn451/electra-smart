# Electra Control PWA (Cloudflare)

This repo now contains a PWA front-end and Cloudflare Pages Functions backend (serverless) for Electra Smart control.

- Frontend (vanilla): `app/public`
- Backend (Pages Functions): `app/functions`
- Local dev secrets: `app/.dev.vars` (not committed)

Quick start:

1. Install: `npm i`
2. Create `app/.dev.vars` with:
   - ELECTRA_IMEI=2b95...
   - ELECTRA_TOKEN=...
3. Run dev: `npm run dev`
4. Visit local URL shown by Wrangler

Deploy: `npm run deploy` (then set secrets in Pages project).

PWA caching:
- Cache-first for static assets
- Network-first for API JSON with fallback for offline (read-only)