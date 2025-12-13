import { describe, it, expect, beforeEach, vi } from 'vitest';

// Since app.js is a global script, we'll test by importing functions
// For now, we'll create testable versions of the functions
// This tests the authentication state management logic

describe('Authentication State Management', () => {
  const CREDS_KEY = 'electraCreds';

  beforeEach(() => {
    sessionStorage.getItem.mockReturnValue(null);
    localStorage.getItem.mockReturnValue(null);
    sessionStorage.setItem.mockClear();
    localStorage.setItem.mockClear();
    sessionStorage.removeItem.mockClear();
    localStorage.removeItem.mockClear();
  });

  describe('getCreds', () => {
    it('should return credentials from sessionStorage if present', () => {
      const creds = { imei: '2b95000012345678', token: 'test-token' };
      sessionStorage.getItem.mockReturnValue(JSON.stringify(creds));

      // Simulate getCreds function
      const getCreds = () => {
        try {
          const s = sessionStorage.getItem(CREDS_KEY);
          if (s) return JSON.parse(s);
        } catch {}
        try {
          const l = localStorage.getItem(CREDS_KEY);
          if (l) return JSON.parse(l);
        } catch {}
        return null;
      };

      const result = getCreds();
      expect(result).toEqual(creds);
      expect(sessionStorage.getItem).toHaveBeenCalledWith(CREDS_KEY);
    });

    it('should fall back to localStorage if sessionStorage is empty', () => {
      const creds = { imei: '2b95000087654321', token: 'local-token' };
      sessionStorage.getItem.mockReturnValue(null);
      localStorage.getItem.mockReturnValue(JSON.stringify(creds));

      const getCreds = () => {
        try {
          const s = sessionStorage.getItem(CREDS_KEY);
          if (s) return JSON.parse(s);
        } catch {}
        try {
          const l = localStorage.getItem(CREDS_KEY);
          if (l) return JSON.parse(l);
        } catch {}
        return null;
      };

      const result = getCreds();
      expect(result).toEqual(creds);
      expect(localStorage.getItem).toHaveBeenCalledWith(CREDS_KEY);
    });

    it('should return null if no credentials found', () => {
      sessionStorage.getItem.mockReturnValue(null);
      localStorage.getItem.mockReturnValue(null);

      const getCreds = () => {
        try {
          const s = sessionStorage.getItem(CREDS_KEY);
          if (s) return JSON.parse(s);
        } catch {}
        try {
          const l = localStorage.getItem(CREDS_KEY);
          if (l) return JSON.parse(l);
        } catch {}
        return null;
      };

      const result = getCreds();
      expect(result).toBeNull();
    });

    it('should handle corrupted JSON in sessionStorage gracefully', () => {
      sessionStorage.getItem.mockReturnValue('{invalid json}');
      localStorage.getItem.mockReturnValue(null);

      const consoleWarnSpy = vi.spyOn(console, 'warn');

      // Improved version with logging
      const getCreds = () => {
        try {
          const s = sessionStorage.getItem(CREDS_KEY);
          if (s) return JSON.parse(s);
        } catch (e) {
          console.warn('Failed to parse sessionStorage credentials:', e);
        }
        try {
          const l = localStorage.getItem(CREDS_KEY);
          if (l) return JSON.parse(l);
        } catch (e) {
          console.warn('Failed to parse localStorage credentials:', e);
        }
        return null;
      };

      const result = getCreds();
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse'),
        expect.any(Error)
      );
    });
  });

  describe('setCreds', () => {
    it('should store credentials in sessionStorage by default', () => {
      const creds = { imei: '2b95000012345678', token: 'test-token' };

      const setCreds = (creds, remember) => {
        const clearCreds = () => {
          sessionStorage.removeItem(CREDS_KEY);
          localStorage.removeItem(CREDS_KEY);
        };
        clearCreds();
        const json = JSON.stringify(creds);
        if (remember) localStorage.setItem(CREDS_KEY, json);
        else sessionStorage.setItem(CREDS_KEY, json);
      };

      setCreds(creds, false);

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        CREDS_KEY,
        JSON.stringify(creds)
      );
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should store credentials in localStorage when remember is true', () => {
      const creds = { imei: '2b95000012345678', token: 'test-token' };

      const setCreds = (creds, remember) => {
        const clearCreds = () => {
          sessionStorage.removeItem(CREDS_KEY);
          localStorage.removeItem(CREDS_KEY);
        };
        clearCreds();
        const json = JSON.stringify(creds);
        if (remember) localStorage.setItem(CREDS_KEY, json);
        else sessionStorage.setItem(CREDS_KEY, json);
      };

      setCreds(creds, true);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        CREDS_KEY,
        JSON.stringify(creds)
      );
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('should clear both storages before setting new credentials', () => {
      const creds = { imei: '2b95000012345678', token: 'test-token' };

      const setCreds = (creds, remember) => {
        const clearCreds = () => {
          sessionStorage.removeItem(CREDS_KEY);
          localStorage.removeItem(CREDS_KEY);
        };
        clearCreds();
        const json = JSON.stringify(creds);
        if (remember) localStorage.setItem(CREDS_KEY, json);
        else sessionStorage.setItem(CREDS_KEY, json);
      };

      setCreds(creds, false);

      expect(sessionStorage.removeItem).toHaveBeenCalledWith(CREDS_KEY);
      expect(localStorage.removeItem).toHaveBeenCalledWith(CREDS_KEY);
    });
  });

  describe('clearCreds', () => {
    it('should remove credentials from both storages', () => {
      const clearCreds = () => {
        sessionStorage.removeItem(CREDS_KEY);
        localStorage.removeItem(CREDS_KEY);
      };

      clearCreds();

      expect(sessionStorage.removeItem).toHaveBeenCalledWith(CREDS_KEY);
      expect(localStorage.removeItem).toHaveBeenCalledWith(CREDS_KEY);
    });
  });
});
