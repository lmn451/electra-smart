# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands for this repo
- Install dependencies:
  - Prefer pnpm (pnpm-lock.yaml and packageManager=pnpm present): pnpm install
  - Alternative if pnpm is not available: npm install
- Start local development (Cloudflare Pages, local mode):
  - npm run dev
  - Under the hood: wrangler pages dev . --local --compatibility-date=2025-09-26
- Deploy to Cloudflare Pages:
  - npm run deploy
  - Under the hood: wrangler pages deploy .
- Linting: not configured (no eslint/prettier configs found)
- Tests: not configured (no test frameworks or scripts present)

## High-level architecture overview
- Overview
  - This is a simple PWA with a vanilla frontend at the repo root (index.html, app.js, styles.css, manifest.webmanifest, service-worker.js) and a Cloudflare Pages Functions backend under functions/api.
  - The app integrates with Electra’s upstream API via backend functions. There is no server-side credential fallback: device/control requests must include two headers: X-Electra-IMEI and X-Electra-Token. The frontend manages these after OTP verification.
  - The OpenAPI specification (openapi.yaml) documents the /api surface and the two required headers.

- Frontend (PWA)
  - index.html renders an auth panel (OTP flow) and a devices UI. app.js drives the OTP send/verify, stores credentials (sessionStorage by default; localStorage when "Remember me" is checked), polls device status, and issues control/power commands via fetch to /api endpoints. styles.css provides the styling.
  - service-worker.js caches only static app shell assets and explicitly bypasses all /api/* requests to avoid stale data.

- Backend (Cloudflare Pages Functions)
  - File-based routes in functions/api implement the API: health.js, auth/start.js, auth/verify.js, devices.js, status/[ac_id].js, command.js, power.js.
  - Auth endpoints (start/verify) do not require a token; they generate/return IMEI and token. All other endpoints require both X-Electra-IMEI and X-Electra-Token headers and return JSON.
  - Shared Electra client logic is in functions/api/_lib/electra.js:
    - Performs RPCs to https://app.ecpiot.co.il/mobile/mobilecommand with consistent headers and an OS fingerprint where needed.
    - Maintains a per-credential SID cache (~60 seconds) and transparently refreshes/retries on SID issues (VALIDATE_TOKEN, getSid/refreshSid/postWithSid).
    - Exposes helpers: sendOtp (SEND_OTP), verifyOtp (CHECK_OTP), listDevices (GET_DEVICES), getStatus/getStatusRaw (GET_LAST_TELEMETRY), getTelemetry, sendCommand, and sendOperMerge (merges desired OPER changes into current state with SPT type normalization).
  - Error handling: upstream failures are surfaced as HTTP 502 with res_desc for debugging.

- API surface (see openapi.yaml for full details)
  - GET /api/health — basic health check.
  - POST /api/auth/start — request OTP, returns an IMEI the client should use.
  - POST /api/auth/verify — verify OTP, returns { imei, token }.
  - GET /api/devices — list devices (requires headers).
  - GET /api/status/{ac_id} — parsed status (requires headers).
  - POST /api/command — merge-and-apply OPER changes (requires headers).
  - POST /api/power — toggle power, using TURN_ON_OFF if available or AC_MODE fallback (requires headers).

### Notes distilled from README
- OTP-based vendor auth is supported directly in the app; every request must include X-Electra-IMEI and X-Electra-Token.
- The service worker does not cache API responses.
- Tokens are stored client-side; SID is cached server-side per IMEI+Token for ~60 seconds; the app does not log tokens.
- Quick start:
  - Install dependencies, then npm run dev, then use the "Sign in" panel to send and verify the OTP; subsequent requests automatically include the required headers.
