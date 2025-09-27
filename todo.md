# Qwik Migration TODO (Cloudflare Pages PWA)

Goal: Migrate the vanilla PWA frontend to Qwik (Qwik City) with static generation, preserving the existing Cloudflare Pages Functions backend and the current PWA behavior. Priorities: minimal bundle size, PWA must, signals for state; consider XState for complex flows.

Key constraints
- Keep functions/api/* unchanged (existing Pages Functions, header-based auth, OTP endpoints). No SSR worker output from Qwik.
- Preserve PWA: service worker at /service-worker.js; do not cache /api/*.
- Static build to dist/ for deployment; use Pages Git build or wrangler pages deploy dist.

Phase 0 — Prep
- [ ] Confirm: Qwik City via static adapter (no SSR functions). Backend stays in functions/api.
- [ ] Confirm: Keep current service-worker.js and manifest.webmanifest as-is.
- [ ] Decide on TypeScript (Qwik defaults to TS; acceptable).

Phase 1 — Scaffolding and layout
- [ ] Add dependencies: @builder.io/qwik, @builder.io/qwik-city, vite, (typescript optional).
- [ ] Create project layout:
  - [ ] public/: move manifest.webmanifest, icons/*, service-worker.js
  - [ ] src/: create Qwik app files (root, routes, components)
  - [ ] index.html at project root (Vite default)
- [ ] Vite config:
  - [ ] outDir: dist
  - [ ] Dev proxy: '/api' -> 'http://127.0.0.1:8788' (wrangler pages dev)
- [ ] Configure Qwik City static adapter (build emits only static files):
  - [ ] Add adapters/static config; avoid emitting any Cloudflare Pages functions from Qwik

Phase 2 — PWA preservation
- [ ] Keep service-worker.js logic unchanged (cache app shell; bypass /api/* network-only).
- [ ] Ensure public/service-worker.js builds to /service-worker.js in dist/.
- [ ] Keep registration minimal: navigator.serviceWorker.register('/service-worker.js').

Phase 3 — Port UI to Qwik (signals + optional XState)
- [ ] Shared utilities
  - [ ] apiFetch helper: inject X-Electra-IMEI and X-Electra-Token for /api/*
  - [ ] Storage utils: sessionStorage/localStorage for creds (remember me)
  - [ ] Status mapping: mapStatusFields, pickCurrentTemp equivalent
- [ ] Components/pages
  - [ ] Root layout and toolbar/status line
  - [ ] AuthPanel: phone step, code step, resend timer, remember me, edit phone
  - [ ] DevicesList: fetch devices; render DeviceCard grid
  - [ ] DeviceCard: badge, fields (mode/fan/setpoint/current), controls (mode/fan/temp), actions (apply, refresh, power on/off)
- [ ] State management
  - [ ] Signals/stores for creds, devices[], statusMap, autoRefresh settings
  - [ ] Visibility and auto-refresh with useVisibleTask$/useTask$
  - [ ] XState (optional): OTP state machine (idle -> codeSent -> verifying -> signedIn; resend/error), and a small machine for apply/power command states

Phase 4 — Dev workflow
- [ ] Two-process dev
  - [ ] Terminal A: wrangler pages dev . --local (serves functions)
  - [ ] Terminal B: vite (with '/api' proxy)
- [ ] Verify flows
  - [ ] OTP start/verify; creds persisted; headers injected
  - [ ] Devices load and per-device status refresh
  - [ ] Apply changes and power toggle work; status updates
  - [ ] PWA offline still serves app shell; /api/* never cached

Phase 5 — Build & deploy
- [ ] package.json scripts
  - [ ] dev: vite
  - [ ] build: vite build
  - [ ] preview: vite preview
  - [ ] cf:dev: wrangler pages dev dist
  - [ ] deploy: wrangler pages deploy dist
- [ ] Prefer Git-based Cloudflare Pages deployment
  - [ ] Build command: npm run build (or pnpm build)
  - [ ] Output dir: dist
  - [ ] Functions dir: repo root (auto-detected)
- [ ] Confirm production has /service-worker.js and manifest working

Phase 6 — Audit & optimize
- [ ] Lighthouse PWA audit: manifest, SW, offline, no caching of /api/*
- [ ] Measure bundle sizes; review chunks; tree-shake/code-split if needed
- [ ] Sanity-check any generated _routes.json (if any): ensure service-worker.js and manifest are treated as static

Phase 7 — Docs & rollback
- [ ] Update README: dev scripts, proxy setup, build/deploy steps
- [ ] Keep migration on a 'qwik' branch; rollback by switching back to main or redeploying previous artifact
- [ ] Bump SW cache version if asset names/paths change

Acceptance criteria
- App runs locally through Vite + wrangler with identical features to current vanilla app.
- PWA functionality preserved; /api/* bypassed from cache; offline app shell works.
- Static build deployed to Cloudflare Pages with functions/api unchanged and working.
- Bundle size and startup times improve or are comparable to current vanilla build.
