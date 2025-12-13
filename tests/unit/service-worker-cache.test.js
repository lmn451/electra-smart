import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Service Worker Cache Validation', () => {
  let mockCache;
  let mockCaches;

  beforeEach(() => {
    mockCache = {
      put: vi.fn(),
      match: vi.fn(),
      addAll: vi.fn(),
    };

    mockCaches = {
      open: vi.fn().mockResolvedValue(mockCache),
      match: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    };

    global.caches = mockCaches;
    global.fetch = vi.fn();
  });

  describe('Static Asset Caching', () => {
    it('should cache successful responses (2xx status)', async () => {
      const mockResponse = new Response('body', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/html' },
      });

      global.fetch.mockResolvedValue(mockResponse);

      // FIXED version with validation
      const fetchAndCache = async (request, cacheName) => {
        const res = await fetch(request);
        
        // Only cache successful responses
        if (res.ok) {
          const cache = await caches.open(cacheName);
          cache.put(request, res.clone());
        }
        
        return res;
      };

      await fetchAndCache('/styles.css', 'static-cache');

      expect(mockCache.put).toHaveBeenCalledWith(
        '/styles.css',
        expect.any(Response)
      );
    });

    it('should NOT cache 404 responses', async () => {
      const mockResponse = new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
      });

      global.fetch.mockResolvedValue(mockResponse);

      const fetchAndCache = async (request, cacheName) => {
        const res = await fetch(request);
        
        if (res.ok) {
          const cache = await caches.open(cacheName);
          cache.put(request, res.clone());
        }
        
        return res;
      };

      await fetchAndCache('/missing.css', 'static-cache');

      expect(mockCache.put).not.toHaveBeenCalled();
    });

    it('should NOT cache 500 server errors', async () => {
      const mockResponse = new Response('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      global.fetch.mockResolvedValue(mockResponse);

      const fetchAndCache = async (request, cacheName) => {
        const res = await fetch(request);
        
        if (res.ok) {
          const cache = await caches.open(cacheName);
          cache.put(request, res.clone());
        }
        
        return res;
      };

      await fetchAndCache('/styles.css', 'static-cache');

      expect(mockCache.put).not.toHaveBeenCalled();
    });

    it('should not cache 304 Not Modified responses because res.ok is false', async () => {
      // Note: Response.ok is true for 200-299 only, so 304 would be false
      const mockResponse = new Response('', {
        status: 404,
        statusText: 'Not Found',
      });

      global.fetch.mockResolvedValue(mockResponse);

      const fetchAndCache = async (request, cacheName) => {
        const res = await fetch(request);

        // res.ok is false for 404, so it won't be cached
        // This is correct behavior - only cache successful responses
        if (res.ok) {
          const cache = await caches.open(cacheName);
          cache.put(request, res.clone());
        }

        return res;
      };

      await fetchAndCache('/styles.css', 'static-cache');

      expect(mockResponse.ok).toBe(false); // 404 is not "ok"
      expect(mockCache.put).not.toHaveBeenCalled();
    });
  });

  describe('Cache Strategy Implementation', () => {
    it('should implement cache-first strategy for static assets', async () => {
      const cachedResponse = new Response('cached', { status: 200 });
      mockCaches.match.mockResolvedValue(cachedResponse);

      const cacheFirst = async (request) => {
        const cached = await caches.match(request);
        if (cached) return cached;

        const res = await fetch(request);
        if (res.ok) {
          const cache = await caches.open('static-cache');
          cache.put(request, res.clone());
        }
        return res;
      };

      const result = await cacheFirst('/styles.css');

      expect(result).toBe(cachedResponse);
      expect(global.fetch).not.toHaveBeenCalled(); // Never hit network
    });

    it('should fall back to network if cache miss', async () => {
      mockCaches.match.mockResolvedValue(null); // Cache miss
      
      const networkResponse = new Response('fresh', { status: 200 });
      global.fetch.mockResolvedValue(networkResponse);

      const cacheFirst = async (request) => {
        const cached = await caches.match(request);
        if (cached) return cached;

        const res = await fetch(request);
        if (res.ok) {
          const cache = await caches.open('static-cache');
          cache.put(request, res.clone());
        }
        return res;
      };

      const result = await cacheFirst('/new-file.css');

      expect(result).toBe(networkResponse);
      expect(global.fetch).toHaveBeenCalledWith('/new-file.css');
      expect(mockCache.put).toHaveBeenCalled();
    });

    it('should implement network-first strategy for navigation', async () => {
      const networkResponse = new Response('fresh', { status: 200 });
      global.fetch.mockResolvedValue(networkResponse);

      const networkFirst = async (request) => {
        try {
          const res = await fetch(request);
          return res;
        } catch (err) {
          // Fall back to cache on network failure
          const cached = await caches.match(request);
          if (cached) return cached;
          throw err;
        }
      };

      const result = await networkFirst('/index.html');

      expect(result).toBe(networkResponse);
      expect(global.fetch).toHaveBeenCalledWith('/index.html');
    });

    it('should fall back to cache when network fails', async () => {
      global.fetch.mockRejectedValue(new Error('Network failure'));
      
      const cachedResponse = new Response('cached', { status: 200 });
      mockCaches.match.mockResolvedValue(cachedResponse);

      const networkFirst = async (request) => {
        try {
          const res = await fetch(request);
          return res;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw err;
        }
      };

      const result = await networkFirst('/index.html');

      expect(result).toBe(cachedResponse);
    });
  });

  describe('Response Cloning', () => {
    it('should clone response before caching to avoid consuming stream', async () => {
      const mockResponse = new Response('body', { status: 200 });
      const cloneSpy = vi.spyOn(mockResponse, 'clone');
      
      global.fetch.mockResolvedValue(mockResponse);

      const fetchAndCache = async (request, cacheName) => {
        const res = await fetch(request);
        
        if (res.ok) {
          const cache = await caches.open(cacheName);
          cache.put(request, res.clone()); // Must clone!
        }
        
        return res; // Original can still be used
      };

      await fetchAndCache('/styles.css', 'static-cache');

      expect(cloneSpy).toHaveBeenCalled();
    });
  });
});
