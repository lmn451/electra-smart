# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Overview
- Purpose: Electra Control PWA with a Cloudflare Pages Functions backend. The frontend is a vanilla HTML/JS app, and all device/control APIs are proxied through Pages Functions.
- Auth model: OTP flow issues an IMEI and token; every /api/* request must include both headers: X-Electra-IMEI and X-Electra-Token. The client manages these; the server caches an upstream SID per IMEI+Token for ~60s.
- PWA: Service Worker caches only the static app shell. /api/* is always network-only (never cached).

Commands (MacOS, zsh)
- Install dependencies (pnpm):
  - pnpm install
- Start local dev (two-process):
  - Terminal A (functions): pnpm cf:dev
  - Terminal B (frontend): pnpm dev
- Build static assets:
  - pnpm build
- Deploy to Cloudflare Pages (static site + functions):
  - pnpm deploy
- Lint: not configured in this repo.
- Tests: not configured in this repo. There is no single-test command.

How local dev works
- pnpm dev runs: wrangler pages dev . --local (compatibility date pinned in package.json). This hosts the static files in the repo root and mounts functions/ under /api/*.
- Sign-in flow (from the UI):
  1) Enter a phone number and “Send code”. The server generates an IMEI and triggers upstream OTP.
  2) Enter the 6-digit code and “Verify”. The server returns { imei, token }.
  3) The client stores credentials in sessionStorage or localStorage and automatically sends X-Electra-IMEI and X-Electra-Token on /api/* calls.
- No local env vars are required. .dev.vars.example clarifies that credentials are obtained at runtime via OTP.

Architecture (big picture)
- Frontend (Preact + Vite):
  - index.html bootstraps the app and registers the Service Worker at /service-worker.js.
  - src/ contains Preact components and logic for OTP sign-in, credentials storage, device list rendering, status refresh, apply/power commands. apiFetch() injects the required headers for /api/*.
  - public/ contains styles.css, manifest.webmanifest, service-worker.js, and other static assets.
  - PWA: cache-first only for the static app shell; /api/* bypassed.
- Backend (Cloudflare Pages Functions in functions/api):
  - auth/start -> issues IMEI and sends OTP (client may provide an IMEI override; otherwise generated server-side).
  - auth/verify -> validates code and returns { imei, token }.
  - devices -> lists devices for the current credentials.
  - status/[ac_id] -> returns parsed telemetry for a device.
  - command -> merges requested changes into OPER and sends a command upstream.
  - power -> toggles device power using TURN_ON_OFF when available, else AC_MODE fallback.
  - Shared client (functions/api/_lib/electra.js): talks to app.ecpiot.co.il/mobile/mobilecommand, caches SID per creds for ~60s, retries once on SID failure, and normalizes commandJson parsing.
- API reference: openapi.yaml at repo root describes all endpoints and security headers.

Operational notes
- Dev: run functions and frontend separately (pnpm cf:dev + pnpm dev). Vite proxies '/api' to wrangler on 127.0.0.1:8788.
- Service Worker: do not cache /api/*; only cache the static app shell. Keep registration as navigator.serviceWorker.register('/service-worker.js').
- Credentials: never stored server-side; sidCache is a transient per-IMEI+Token optimization in memory.
- No lint/test setup present. If you add them later, update this file with the exact commands.

Key files
- index.html, public/styles.css, public/manifest.webmanifest, public/service-worker.js
- src/**/* (Preact app)
- functions/api/**/* (endpoints listed above)
- openapi.yaml (OpenAPI 3.0 spec)
- .dev.vars.example (no local secrets required)
