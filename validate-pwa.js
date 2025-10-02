/**
 * PWA Validation Script for Electra Control
 * Run this in browser console or include as script to validate PWA setup
 */

class PWAValidator {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);

    if (type === 'pass') this.results.passed.push(message);
    else if (type === 'fail') this.results.failed.push(message);
    else if (type === 'warn') this.results.warnings.push(message);
  }

  async validateManifest() {
    this.log('Validating Web App Manifest...', 'info');

    try {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (!manifestLink) {
        this.log('No manifest link found in HTML', 'fail');
        return;
      }
      this.log('Manifest link found in HTML', 'pass');

      const response = await fetch(manifestLink.href);
      const manifest = await response.json();

      // Required fields
      const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
      requiredFields.forEach(field => {
        if (manifest[field]) {
          this.log(`Manifest has required field: ${field}`, 'pass');
        } else {
          this.log(`Manifest missing required field: ${field}`, 'fail');
        }
      });

      // Icons validation
      if (manifest.icons && manifest.icons.length > 0) {
        this.log(`Found ${manifest.icons.length} icons in manifest`, 'pass');

        const has192 = manifest.icons.some(icon => icon.sizes?.includes('192'));
        const has512 = manifest.icons.some(icon => icon.sizes?.includes('512'));
        const hasMaskable = manifest.icons.some(icon => icon.purpose?.includes('maskable'));

        if (has192) this.log('Has 192x192 icon', 'pass');
        else this.log('Missing 192x192 icon', 'fail');

        if (has512) this.log('Has 512x512 icon', 'pass');
        else this.log('Missing 512x512 icon', 'fail');

        if (hasMaskable) this.log('Has maskable icons', 'pass');
        else this.log('No maskable icons found', 'warn');
      }

      // Theme colors
      if (manifest.theme_color) this.log('Theme color defined', 'pass');
      else this.log('No theme color defined', 'warn');

      if (manifest.background_color) this.log('Background color defined', 'pass');
      else this.log('No background color defined', 'warn');

    } catch (error) {
      this.log(`Error validating manifest: ${error.message}`, 'fail');
    }
  }

  async validateServiceWorker() {
    this.log('Validating Service Worker...', 'info');

    if (!('serviceWorker' in navigator)) {
      this.log('Service Worker not supported', 'fail');
      return;
    }
    this.log('Service Worker supported', 'pass');

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        this.log('Service Worker registered', 'pass');

        if (registration.active) {
          this.log('Service Worker is active', 'pass');
        } else {
          this.log('Service Worker is not active', 'warn');
        }

        // Test cache functionality
        if ('caches' in window) {
          this.log('Cache API available', 'pass');
          const cacheNames = await caches.keys();
          if (cacheNames.length > 0) {
            this.log(`Found ${cacheNames.length} cache(s): ${cacheNames.join(', ')}`, 'pass');
          } else {
            this.log('No caches found', 'warn');
          }
        }
      } else {
        this.log('Service Worker not registered', 'fail');
      }
    } catch (error) {
      this.log(`Error checking Service Worker: ${error.message}`, 'fail');
    }
  }

  validateHTMMetaTags() {
    this.log('Validating HTML Meta Tags...', 'info');

    // Viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && viewport.content.includes('width=device-width')) {
      this.log('Proper viewport meta tag found', 'pass');
    } else {
      this.log('Missing or incorrect viewport meta tag', 'fail');
    }

    // Theme color
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      this.log('Theme color meta tag found', 'pass');
    } else {
      this.log('Theme color meta tag missing', 'warn');
    }

    // Apple meta tags
    const appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');

    if (appleCapable) this.log('Apple mobile web app capable tag found', 'pass');
    else this.log('Apple mobile web app capable tag missing', 'warn');

    if (appleTitle) this.log('Apple mobile web app title found', 'pass');
    else this.log('Apple mobile web app title missing', 'warn');

    // Description
    const description = document.querySelector('meta[name="description"]');
    if (description && description.content.trim()) {
      this.log('Description meta tag found', 'pass');
    } else {
      this.log('Description meta tag missing or empty', 'warn');
    }
  }

  validateIcons() {
    this.log('Validating Icons...', 'info');

    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (appleIcon) {
      this.log('Apple touch icon found', 'pass');
    } else {
      this.log('Apple touch icon missing', 'warn');
    }

    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      this.log('Favicon found', 'pass');
    } else {
      this.log('Favicon missing', 'warn');
    }
  }

  validateResponsiveness() {
    this.log('Validating Responsiveness...', 'info');

    // Check if CSS has media queries
    const stylesheets = Array.from(document.styleSheets);
    let hasMediaQueries = false;

    try {
      stylesheets.forEach(sheet => {
        if (sheet.cssRules) {
          Array.from(sheet.cssRules).forEach(rule => {
            if (rule instanceof CSSMediaRule) {
              hasMediaQueries = true;
            }
          });
        }
      });

      if (hasMediaQueries) {
        this.log('CSS media queries found', 'pass');
      } else {
        this.log('No CSS media queries found', 'warn');
      }
    } catch (error) {
      this.log('Could not check CSS media queries (CORS)', 'warn');
    }

    // Check viewport dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.log(`Current viewport: ${width}x${height}`, 'info');
  }

  validateInstallability() {
    this.log('Validating Installability...', 'info');

    // Check if running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      this.log('App is running in standalone mode', 'pass');
    } else {
      this.log('App is not in standalone mode', 'info');
    }

    // Check for beforeinstallprompt
    let installPromptSupported = false;
    window.addEventListener('beforeinstallprompt', () => {
      installPromptSupported = true;
      this.log('Install prompt is available', 'pass');
    });

    setTimeout(() => {
      if (!installPromptSupported) {
        this.log('Install prompt not available (may already be installed)', 'info');
      }
    }, 1000);
  }

  validateHTTPS() {
    this.log('Validating HTTPS...', 'info');

    if (location.protocol === 'https:' || location.hostname === 'localhost') {
      this.log('App is served over HTTPS or localhost', 'pass');
    } else {
      this.log('App is NOT served over HTTPS (required for PWA)', 'fail');
    }
  }

  async validateOfflineCapability() {
    this.log('Validating Offline Capability...', 'info');

    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        if (cacheNames.length > 0) {
          this.log('App has offline caching', 'pass');

          // Test if main resources are cached
          const mainCache = await caches.open(cacheNames[0]);
          const cachedResources = await mainCache.keys();
          this.log(`${cachedResources.length} resources cached`, 'info');
        } else {
          this.log('No offline caching found', 'warn');
        }
      } catch (error) {
        this.log(`Error checking offline capability: ${error.message}`, 'warn');
      }
    } else {
      this.log('Cache API not supported', 'fail');
    }
  }

  async runAllValidations() {
    console.log('🔍 Starting PWA Validation for Electra Control');
    console.log('===============================================');

    await this.validateHTTPS();
    await this.validateManifest();
    await this.validateServiceWorker();
    this.validateHTMMetaTags();
    this.validateIcons();
    this.validateResponsiveness();
    this.validateInstallability();
    await this.validateOfflineCapability();

    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 PWA Validation Summary');
    console.log('=========================');
    console.log(`✅ Passed: ${this.results.passed.length}`);
    console.log(`❌ Failed: ${this.results.failed.length}`);
    console.log(`⚠️ Warnings: ${this.results.warnings.length}`);

    if (this.results.failed.length === 0) {
      console.log('\n🎉 Congratulations! Your PWA passes all critical validations!');
    } else {
      console.log('\n🔧 Issues to address:');
      this.results.failed.forEach(issue => console.log(`  ❌ ${issue}`));
    }

    if (this.results.warnings.length > 0) {
      console.log('\n💡 Recommendations:');
      this.results.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
    }

    // Calculate PWA Score
    const total = this.results.passed.length + this.results.failed.length;
    const score = total > 0 ? Math.round((this.results.passed.length / total) * 100) : 0;
    console.log(`\n📈 PWA Score: ${score}%`);
  }
}

// Auto-run validation when script loads
if (typeof window !== 'undefined') {
  const validator = new PWAValidator();

  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => validator.runAllValidations(), 1000);
    });
  } else {
    setTimeout(() => validator.runAllValidations(), 1000);
  }

  // Make validator available globally for manual testing
  window.PWAValidator = PWAValidator;
  window.validatePWA = () => new PWAValidator().runAllValidations();
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PWAValidator;
}
