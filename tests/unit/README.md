# Unit Tests for Electra Control PWA

This directory contains unit tests for the Electra Control PWA application. The tests are designed to prevent regressions of discovered bugs and ensure code quality.

## Test Framework

- **Framework**: [Vitest](https://vitest.dev/)
- **Environment**: jsdom (simulates browser APIs)
- **Coverage**: V8 provider

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run tests with UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

## Test Files

### `auth.test.js`
Tests authentication state management:
- `getCreds()` - Reading credentials from storage
- `setCreds()` - Storing credentials with remember-me option
- `clearCreds()` - Logout cleanup
- Error handling for corrupted JSON (bug #electra-bww)

### `optimistic-ui.test.js`
Tests optimistic UI state management:
- `startOptimistic()` - Setting optimistic state
- `pollOptimistic()` - Polling and reconciliation
- Timer cleanup to prevent memory leaks (bug #electra-zfa)
- Logout cleanup for optimistic state (bug #electra-h56)

### `race-conditions.test.js`
Tests race condition prevention:
- Power toggle double-click protection (bug #electra-fcl)
- Temperature control during pending operations
- Mode/fan change locking
- Concurrent operations on different devices

### `temperature.test.js`
Tests temperature input validation:
- `stepTemp()` - Increment/decrement within bounds
- `applyTemp()` - Validation and clamping
- Handling invalid input (letters, symbols) (bug #electra-tzf)
- User feedback for errors

### `service-worker-cache.test.js`
Tests service worker caching strategies:
- Cache validation (only 2xx responses) (bug #electra-9sj)
- Cache-first strategy for static assets
- Network-first strategy for navigation
- Response cloning before caching

### `imei-generation.test.js`
Tests IMEI generation:
- Current implementation analysis (Math.random)
- Collision probability calculations
- Improved implementation with crypto.randomUUID (bug #electra-ltw)
- IMEI format validation

## Coverage Goals

Target coverage: **80%+**

Key areas:
- ✅ Authentication flows
- ✅ Optimistic UI logic
- ✅ Race condition prevention
- ✅ Input validation
- ✅ Service worker caching
- ⚠️ API client (functions/api/_lib/electra.js) - Requires integration tests
- ⚠️ DOM manipulation - Requires E2E tests with Playwright

## Writing New Tests

### Structure
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup mocks
  });

  describe('Sub-feature', () => {
    it('should behave correctly', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Best Practices
1. **Isolate tests**: Use `beforeEach` to reset state
2. **Mock external dependencies**: Use `vi.fn()` for mocks
3. **Test edge cases**: Empty inputs, null, undefined, invalid data
4. **Use descriptive names**: `it('should reject non-numeric input')`
5. **Arrange-Act-Assert**: Clear test structure
6. **Test both buggy and fixed versions**: Show the problem and solution

### Mocking Browser APIs
```javascript
// Mock localStorage/sessionStorage
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

// Mock fetch
global.fetch = vi.fn().mockResolvedValue(
  new Response('{}', { status: 200 })
);

// Mock timers
vi.useFakeTimers();
await vi.advanceTimersByTimeAsync(1000);
vi.useRealTimers();
```

## Related Issues

These tests address the following bugs:

| Test File | Bug ID | Description |
|-----------|--------|-------------|
| `optimistic-ui.test.js` | electra-zfa | Memory leak in pollOptimistic |
| `race-conditions.test.js` | electra-fcl | Power toggle race condition |
| `service-worker-cache.test.js` | electra-9sj | Cache validation missing |
| `optimistic-ui.test.js` | electra-h56 | Logout cleanup missing |
| `temperature.test.js` | electra-tzf | Temperature validation |
| `imei-generation.test.js` | electra-ltw | IMEI collision risk |
| `auth.test.js` | electra-bww | Silent getCreds errors |

## CI/CD Integration

Tests run automatically on:
- Pre-commit (via git hooks)
- Pull requests
- Deploy pipeline

Required: All tests must pass before deployment.

## Troubleshooting

### Tests fail with "fetch is not defined"
Ensure `jsdom` environment is configured in `vitest.config.js` and fetch is mocked in `tests/setup.js`.

### Timer tests are flaky
Use `vi.useFakeTimers()` and `vi.advanceTimersByTimeAsync()` instead of `setTimeout`.

### Coverage is too low
Check which files are excluded in `vitest.config.js`. Service worker and Cloudflare Functions are tested separately.

## Future Improvements

- [ ] Add integration tests for API endpoints
- [ ] Add E2E tests for complete user flows with Playwright
- [ ] Add performance regression tests
- [ ] Add visual regression tests for UI components
- [ ] Add accessibility tests (axe-core)
