// Vitest setup file
import { beforeEach, afterEach, vi } from 'vitest';

// Mock browser APIs that aren't in jsdom
beforeEach(() => {
  // Mock sessionStorage
  global.sessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  // Mock localStorage
  global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  // Mock fetch
  global.fetch = vi.fn();

  // Mock console methods to avoid noise in tests
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
