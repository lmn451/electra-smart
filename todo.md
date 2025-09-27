# Svelte Migration TODO (Cloudflare Pages PWA)

Goal: Migrate the vanilla PWA frontend to Svelte (Vite-powered SPA), preserving the existing Cloudflare Pages Functions backend and the current PWA behavior. Keep routing client-side, avoid SSR to prevent conflicts with functions/, and keep the /api contract unchanged.

Key constraints
- Keep functions/api/* unchanged (existing Pages Functions, header-based auth, OTP endpoints). No SSR output from the UI build.
- Preserve PWA: service worker at /service-worker.js; do not cache /api/*.
- Static UI build to web/dist (preferred) or dist at repo root; deploy via wrangler pages deploy.

Phase 0 — Decisions
- [ ] Choose UI layout: create a dedicated UI app in web/ to avoid colliding with functions/.
- [ ] Pick language: JS or TS (recommended: TS in Svelte template).
- [ ] PWA approach: reuse current service-worker.js and manifest.webmanifest initially; consider vite-plugin-pwa later if desired.
- [ ] Dev workflow: pick one
  - Option A (simple): watch-build to web/dist + wrangler pages dev web/dist (single origin for API and UI)
  - Option B (faster HMR): Vite dev server with proxy /api -> 127.0.0.1:8788 while wrangler serves functions

Phase 1 — Scaffold Svelte (Vite) in web/
- [ ] Create app
  - [ ] Scaffold: 
    ```bash path=null start=null
    pnpm create vite@latest web -- --template svelte
    # or TypeScript
    pnpm create vite@latest web -- --template svelte-ts
    pnpm -C web install
    ```
  - [ ] Ensure web/vite.config.(ts|js) sets build.outDir to dist (default ok).
- [ ] Move static assets
  - [ ] web/public/manifest.webmanifest (from project root)
  - [ ] web/public/icons/* (create if missing)
  - [ ] web/public/service-worker.js (copy existing as-is)
  - [ ] Ensure registration stays at '/service-worker.js' (keep absolute path)

Phase 2 — API client and state
- [ ] Create web/src/lib/api.ts (or .js)
  - [ ] apiFetch wrapper: adds X-Electra-IMEI and X-Electra-Token for /api/*, JSON default, no-cache
  - [ ] Storage helpers: get/set/clear creds (sessionStorage by default, localStorage when "Remember me")
  - [ ] Status helpers: mapStatusFields, pickCurrentTemp
- [ ] Create Svelte stores
  - [ ] creds store (writable)
  - [ ] devices store (writable)
  - [ ] statusMap store (Map<string, fields>)
  - [ ] auto-refresh store: enabled + seconds; interval management tied to tab visibility

Phase 3 — Components & pages
- [ ] App skeleton
  - [ ] App.svelte: toolbar (refresh, auto-refresh controls), status line
  - [ ] AuthPanel.svelte: phone step, code step, resend timer, remember me, edit phone
  - [ ] Devices.svelte: loads devices and renders DeviceCard grid
  - [ ] DeviceCard.svelte: badge, fields (mode/fan/setpoint/current), controls (mode/fan/temp), actions (apply, refresh, power on/off)
- [ ] Wire actions
  - [ ] OTP: POST /api/auth/start -> IMEI; POST /api/auth/verify -> { imei, token } -> set creds
  - [ ] Devices: GET /api/devices
  - [ ] Status: GET /api/status/{ac_id}
  - [ ] Command: POST /api/command (AC_MODE/FANSPD/SPT)
  - [ ] Power: POST /api/power (TURN_ON_OFF or AC_MODE fallback)

Phase 4 — Dev workflow
- Option A: watch-build + wrangler (single origin, simplest)
  - [ ] In one terminal (UI build):
    ```bash path=null start=null
    pnpm -C web build --watch
    ```
  - [ ] In another terminal (functions + static):
    ```bash path=null start=null
    wrangler pages dev web/dist --local --compatibility-date=2025-09-26
    ```
- Option B: Vite dev server + API proxy (best DX)
  - [ ] Start functions:
    ```bash path=null start=null
    wrangler pages dev . --local --compatibility-date=2025-09-26
    ```
  - [ ] Configure web/vite.config.(ts|js) dev server proxy:
    ```js path=null start=null
    // inside defineConfig({ server: { proxy: { '/api': 'http://127.0.0.1:8788' } } })
    ```
  - [ ] Start Vite:
    ```bash path=null start=null
    pnpm -C web dev
    ```

Phase 5 — Build & deploy
- [ ] Add or update top-level scripts (optional convenience)
  - [ ] Install concurrently at repo root (optional):
    ```bash path=null start=null
    pnpm add -D concurrently
    ```
  - [ ] Example scripts (top-level package.json):
    ```json path=null start=null
    {
      "scripts": {
        "web:dev": "pnpm -C web dev",
        "web:build": "pnpm -C web build",
        "dev:a": "pnpm -C web build --watch",
        "dev:b": "wrangler pages dev web/dist --local --compatibility-date=2025-09-26",
        "dev": "concurrently -k -n ui,cf \"pnpm:dev:a\" \"pnpm:dev:b\"",
        "deploy": "wrangler pages deploy web/dist"
      }
    }
    ```
- [ ] Deploy with wrangler:
  ```bash path=null start=null
  pnpm -C web build
  wrangler pages deploy web/dist
  ```
- [ ] If using Git-based Pages, set build command to "pnpm -C web build" and output directory to "web/dist"; functions directory remains at repo root.

Phase 6 — Parity and cleanup
- [ ] Verify parity:
  - [ ] OTP flow behaves identical; creds persisted; headers injected
  - [ ] Devices load, status refresh works; apply and power actions succeed
  - [ ] PWA offline serves shell; /api/* never cached by SW
- [ ] Update docs:
  - [ ] README: dev choices (Option A vs B), scripts, deploy path
  - [ ] WARP.md: reflect new dev commands if changed
- [ ] Remove legacy files after verification: index.html, app.js, styles.css (and related inline SW registration) at repo root
- [ ] Bump SW cache version if asset paths change

Optional — SvelteKit alternative (only if SSR/routing needed)
- Use @sveltejs/adapter-cloudflare in "pages" mode or adapter-static; beware of writing into functions/ where your API already lives. Prefer adapter-static to keep the current functions/api contract unchanged.

Acceptance criteria
- App runs locally (Option A or B) with identical features to current vanilla app.
- PWA functionality preserved; /api/* bypassed from cache; offline app shell works.
- Static build deployed to Cloudflare Pages with functions/api unchanged and working.
- Bundle size/startup comparable or improved; UI code organized into Svelte components.
