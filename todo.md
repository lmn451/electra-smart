# Preact Migration TODO (Cloudflare Pages PWA)

Goal: Migrate the vanilla PWA frontend to Preact + Vite (static build), preserving the existing Cloudflare Pages Functions backend and current PWA behavior. Priorities: very small bundle, preserve SW/manifest, fast interactivity; consider @preact/signals for state.

Key constraints
- Keep functions/api/* unchanged (header-based auth, OTP endpoints). No SSR output from the frontend build.
- Preserve PWA: service worker at /service-worker.js; do not cache /api/*.
- Static build to dist/ for deployment; deploy with wrangler pages deploy dist.

Phase 0 — Prep
- [ ] Choose stack: Vite + @preact/preset-vite, preact, @preact/signals (optional), TypeScript (optional).
- [ ] Confirm Vite dev server proxy target for functions (default wrangler pages dev port is used below).

Phase 1 — Scaffolding and layout
- [ ] Add deps:
  - [ ] devDependencies: vite, @preact/preset-vite
  - [ ] dependencies: preact, @preact/signals (optional)
- [ ] Project layout:
  - [ ] public/: move manifest.webmanifest, icons/*, service-worker.js (ensures SW is emitted to /service-worker.js)
  - [ ] src/: create Preact app (main.jsx/tsx, App, components)
  - [ ] index.html at project root, load /src/main.jsx
- [ ] Vite config (vite.config.{js,ts}):
  - [ ] plugins: [preact()] from @preact/preset-vite
  - [ ] build.outDir: dist
  - [ ] server.proxy: { '/api': { target: 'http://127.0.0.1:8788', changeOrigin: true } }

Phase 2 — PWA preservation
- [ ] Keep service-worker.js logic unchanged (cache app shell; bypass /api/* network-only).
- [ ] Ensure public/service-worker.js outputs to /service-worker.js in dist/.
- [ ] Keep registration minimal: navigator.serviceWorker.register('/service-worker.js').

Phase 3 — Port UI to Preact
- [ ] Utilities (src/lib):
  - [ ] apiFetch: inject X-Electra-IMEI and X-Electra-Token on /api/*
  - [ ] storage: sessionStorage/localStorage for creds (remember me)
  - [ ] status mapping: mapStatusFields, pickCurrentTemp
- [ ] Components/pages
  - [ ] App shell: toolbar/status line, online/offline indicators
  - [ ] AuthPanel: phone step, code step, resend timer, remember me, edit phone
  - [ ] DevicesList: fetch devices; render grid of DeviceCard
  - [ ] DeviceCard: badge, fields (mode/fan/setpoint/current), controls (mode/fan/temp), actions (apply, refresh, power on/off)
- [ ] State management
  - [ ] Either hooks (useState/useEffect) or @preact/signals for creds, devices[], statusMap, auto-refresh settings
  - [ ] Handle tab visibility to pause/resume refresh
  - [ ] Optional: state machine for OTP and apply/power actions

Phase 4 — Dev workflow
- [ ] Two-process dev:
  - [ ] Terminal A: wrangler pages dev . --local (serves functions)
  - [ ] Terminal B: vite (with '/api' proxy)
- [ ] Verify flows:
  - [ ] OTP start/verify; creds persisted; headers injected
  - [ ] Devices load and per-device status refresh
  - [ ] Apply changes and power toggle work; status updates
  - [ ] PWA offline serves app shell; /api/* never cached

Phase 5 — Build & deploy
- [ ] package.json scripts:
  - [ ] dev: vite
  - [ ] build: vite build
  - [ ] preview: vite preview
  - [ ] cf:dev: wrangler pages dev dist --local (optional alternative to two-process dev)
  - [ ] deploy: wrangler pages deploy dist
- [ ] Cloudflare Pages (Git-based) settings:
  - [ ] Build command: pnpm build (or npm run build)
  - [ ] Output dir: dist
  - [ ] Functions dir: repo root (auto-detected)
- [ ] Confirm production has /service-worker.js and manifest working

Phase 6 — Audit & optimize
- [ ] Lighthouse PWA audit: manifest, SW, offline, no caching of /api/*
- [ ] Measure bundle sizes; leverage preact + code-splitting as needed
- [ ] Sanity-check any routing/assets handling so SW includes the right app shell

Phase 7 — Docs & rollback
- [ ] Update README: dev scripts, proxy setup, build/deploy steps
- [ ] Keep migration on a 'preact' branch; rollback by switching back or redeploying previous artifact
- [ ] Bump SW cache version if asset names/paths change

Acceptance criteria
- App runs locally through Vite + wrangler with identical features to the current vanilla app.
- PWA functionality preserved; /api/* bypassed from cache; offline app shell works.
- Static build deployed to Cloudflare Pages with functions/api unchanged and working.
- Bundle size and startup times improve or are comparable to the current vanilla build.
