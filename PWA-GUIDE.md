# Electra Control - PWA Guide

## 📱 Progressive Web App Features

Electra Control is a fully-featured Progressive Web App (PWA) that provides a native app-like experience for controlling your Electra air conditioning units.

## ✨ Key PWA Features

### 🚀 **App Installation**
- Install directly from your browser (no app store required)
- Works on desktop, mobile, and tablet devices
- Appears in your device's app launcher/home screen
- Runs in full-screen mode like a native app

### 🌐 **Offline Support**
- App shell loads instantly, even offline
- Cached static resources for fast loading
- Custom offline page when network is unavailable
- Smart caching strategy for optimal performance

### 📲 **Mobile Optimized**
- Responsive design works on all screen sizes
- Touch-friendly interface with proper tap targets
- Native scrolling and gestures
- iOS and Android optimizations

### 🔄 **Automatic Updates**
- Background updates when new versions are available
- User-friendly update prompts
- Seamless update process without disruption

## 📥 Installation Guide

### Chrome/Edge/Safari (Mobile & Desktop)

1. **Open the app** in your browser: `https://your-domain.com`

2. **Look for the install prompt**:
   - **Chrome/Edge**: Click the install icon in the address bar or the "Install App" button
   - **Safari iOS**: Tap the share button → "Add to Home Screen"
   - **Safari macOS**: File menu → "Add to Dock"

3. **Follow the prompts** to install the app

4. **Launch the app** from your home screen, dock, or app launcher

### Manual Installation (if prompt doesn't appear)

#### Chrome/Edge:
1. Click the three-dot menu (⋮)
2. Select "Install Electra Control" or "Add to Home Screen"
3. Confirm the installation

#### Safari iOS:
1. Tap the share button (□ with arrow)
2. Scroll down and tap "Add to Home Screen"
3. Customize the name if desired
4. Tap "Add"

#### Firefox:
1. Click the three-line menu (≡)
2. Select "Install" or "Add to Home Screen"
3. Confirm the installation

## 🔧 PWA Features in Detail

### Installation Detection
The app automatically detects when it can be installed and shows an "📱 Install App" button in the toolbar.

### Offline Experience
- **App Shell**: Core app interface loads instantly from cache
- **Static Assets**: CSS, JavaScript, and images are cached for offline use
- **API Fallback**: When offline, API calls show helpful error messages
- **Offline Page**: Custom page shown when navigating while offline

### Background Updates
- New versions are detected automatically
- Update prompt appears when a new version is ready
- Updates apply immediately without losing your current session

### Device Integration
- **iOS**: Integrates with iOS home screen and app switcher
- **Android**: Appears in app drawer and recent apps
- **Desktop**: Creates desktop shortcuts and taskbar integration
- **Notifications**: Ready for push notifications (if implemented)

## 🎛️ Usage Guide

### First Time Setup
1. Open the app in your browser
2. Install the PWA (see installation guide above)
3. Sign in with your phone number and verification code
4. The app will remember your login for future sessions

### Offline Usage
- The app interface works offline
- Device controls require an internet connection
- Cached data from your last session remains available
- Network status is shown in the app toolbar

### App Updates
- Updates happen automatically in the background
- You'll see a notification when an update is ready
- Click "Update" to apply the new version
- The app will refresh with new features

## 🔍 Troubleshooting

### Installation Issues

**Install button doesn't appear:**
- Make sure you're using a supported browser
- Check that you're on HTTPS (or localhost for development)
- Clear browser cache and reload
- Ensure the app meets PWA criteria

**Installation fails:**
- Check available storage space
- Try using a different browser
- Disable browser extensions temporarily
- Clear browser data and try again

### Offline Issues

**App doesn't work offline:**
- Make sure the app was fully loaded at least once while online
- Check that service worker is registered (see developer tools)
- Clear cache and reload while online

**Outdated content:**
- Force refresh: Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac)
- Clear app cache in browser settings
- Reinstall the app

### Performance Issues

**Slow loading:**
- Clear browser cache
- Check network connection
- Update to latest browser version
- Reinstall the PWA

**High battery usage:**
- Disable auto-refresh when not needed
- Close the app when not in use
- Check for browser updates

## 🛠️ Developer Information

### PWA Validation
Run the included validation script in browser console:
```javascript
validatePWA()
```

### Service Worker
- **Cache Strategy**: Cache-first for static assets, network-first for API calls
- **Cache Name**: `electra-static-v3`
- **Offline Fallback**: Custom offline page for navigation requests

### Manifest Details
- **Name**: Electra Control
- **Short Name**: Electra
- **Display Mode**: Standalone
- **Theme Color**: #0f172a
- **Background Color**: #0b0d10
- **Icons**: 192x192, 512x512 (including maskable variants)

### Browser Support

| Browser | Installation | Offline | Updates |
|---------|-------------|---------|---------|
| Chrome 67+ | ✅ | ✅ | ✅ |
| Edge 79+ | ✅ | ✅ | ✅ |
| Firefox 44+ | ⚠️ | ✅ | ✅ |
| Safari 11.1+ | ⚠️ | ✅ | ⚠️ |
| Samsung Internet | ✅ | ✅ | ✅ |

**Legend:**
- ✅ Full support
- ⚠️ Partial support
- ❌ Not supported

### Testing Checklist

- [ ] App installs on all target devices
- [ ] Works offline (app shell loads)
- [ ] Service worker registers successfully
- [ ] Manifest is valid and accessible
- [ ] Icons display correctly
- [ ] Theme colors applied properly
- [ ] App updates work correctly
- [ ] Responsive on all screen sizes
- [ ] Touch targets are appropriately sized (44px minimum)
- [ ] App behaves like native app when installed

## 🐞 Development Tools

### Chrome DevTools
1. **Application Tab**:
   - Check service worker status
   - Inspect cache contents
   - Test offline mode
   - Validate manifest

2. **Lighthouse Audit**:
   - Run PWA audit
   - Check performance scores
   - Review best practices
   - Get improvement suggestions

### Testing Commands
```bash
# Start development server
pnpm dev

# Deploy to Cloudflare Pages
pnpm deploy

# Validate PWA (in browser console)
validatePWA()
```

### Cache Management
```javascript
// Clear all caches (in browser console)
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});

// Check current caches
caches.keys().then(console.log);
```

## 📚 Additional Resources

- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN PWA Documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## 🆘 Support

If you encounter issues with the PWA functionality:

1. **First Steps**:
   - Clear browser cache and reload
   - Try incognito/private browsing mode
   - Test in a different browser

2. **Check Browser Console**:
   - Look for error messages
   - Check network tab for failed requests
   - Verify service worker status

3. **Run PWA Validation**:
   ```javascript
   validatePWA()
   ```

4. **Report Issues**:
   - Include browser version and device type
   - Provide console error messages
   - Describe steps to reproduce the issue

---

**Last Updated**: January 2025
**PWA Version**: 3.0
**Compatibility**: Modern browsers with PWA support
