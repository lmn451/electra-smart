# Electra Control PWA (Cloudflare)

PWA front-end + Cloudflare Pages Functions backend for Electra Smart control.

Key changes:
- OTP-based vendor auth is supported directly in the app.
- No server-side credential fallback: every request must include X-Electra-IMEI and X-Electra-Token headers (the client manages these via OTP).
- Service Worker does not cache API responses (and never caches /api/*).

Structure:
- Frontend (Preact + Vite): src/, public/
- Backend (Pages Functions): functions/

Quick start (pnpm)
1. Install deps: `pnpm install`
2. Start functions (Terminal A): `pnpm cf:dev` (serves /api/* from functions/, static from dist when built)
3. Start frontend (Terminal B): `pnpm dev` (Vite dev server with '/api' proxy to wrangler)
4. In the UI, use the Sign in panel:
   - Enter your phone number and click "Send code"
   - The server generates an IMEI and sends an OTP via Electra
   - Enter the received code and click Verify
   - On success, requests will automatically carry X-Electra-IMEI and X-Electra-Token headers

Build & deploy
- Build static assets: `pnpm build` (outputs to dist/)
- Deploy to Cloudflare Pages: `pnpm deploy` (deploys dist/ and functions/)

API
- See openapi.yaml at the project root for the full specification.
- Security: All device/control endpoints require both headers: X-Electra-IMEI and X-Electra-Token.

Notes
- Tokens are stored client-side (sessionStorage by default; localStorage when "Remember me" is checked).
- SID is cached server-side in-memory per IMEI+Token for ~60 seconds (transparent to clients).
- The app never logs your token.
