# Electra Control PWA (Cloudflare)

PWA front-end + Cloudflare Pages Functions backend for Electra Smart control.

## 📱 Progressive Web App Features

✨ **Full PWA Experience:**
- 📥 **Install directly from browser** - No app store required
- 🌐 **Works offline** - App shell loads instantly even without internet
- 📲 **Native app experience** - Runs full-screen like a native mobile app
- 🔄 **Automatic updates** - Background updates with user-friendly prompts
- 🎨 **Platform optimized** - iOS, Android, and desktop integration

🚀 **Quick Installation:**
- Chrome/Edge: Click the install button in the address bar
- Safari iOS: Share → "Add to Home Screen"
- All browsers: Look for "📱 Install App" button in the app toolbar

Key changes:
- OTP-based vendor auth is supported directly in the app.
- No server-side credential fallback: every request must include X-Electra-IMEI and X-Electra-Token headers (the client manages these via OTP).
- Service Worker does not cache API responses.

Structure:
- Frontend (vanilla): root (index.html, app.js, styles.css)
- Backend (Pages Functions): functions/

Quick start
1. Install: `npm i`
2. Dev: `npm run dev`
3. In the UI, use the Sign in panel:
   - Enter your phone number and click "Send code"
   - The app generates an IMEI and sends an OTP via Electra
   - Enter the received code and click Verify
   - On success, requests will automatically carry X-Electra-IMEI and X-Electra-Token headers

Deploy
- `npm run deploy`

API
- See openapi.yaml at the project root for the full specification.
- Security: All device/control endpoints require both headers: X-Electra-IMEI and X-Electra-Token.

Notes
- Tokens are stored client-side (sessionStorage by default; localStorage when "Remember me" is checked).
- SID is cached server-side in-memory per IMEI+Token for ~60 seconds (transparent to clients).
- The app never logs your token.
