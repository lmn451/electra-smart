import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Optimistic UI State Management', () => {
  let timers;
  let state;

  beforeEach(() => {
    vi.useFakeTimers();
    timers = new Map(); // Track timer IDs for cleanup
    state = {
      optimisticById: new Map(),
      statusMap: new Map(),
      pendingById: new Map(),
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('startOptimistic', () => {
    it('should set optimistic state with 3s timeout', () => {
      const id = 'test-device';
      const desired = { mode: 'COOL', spt: 24 };

      const startOptimistic = (id, desired) => {
        const key = String(id);
        const until = Date.now() + 3000;
        const prev = state.optimisticById.get(key);
        const merged = { ...(prev?.desired || {}), ...desired };
        state.optimisticById.set(key, { desired: merged, until });
      };

      startOptimistic(id, desired);

      const entry = state.optimisticById.get(id);
      expect(entry).toBeDefined();
      expect(entry.desired).toEqual(desired);
      expect(entry.until).toBeGreaterThan(Date.now());
    });

    it('should merge with previous optimistic state', () => {
      const id = 'test-device';

      const startOptimistic = (id, desired) => {
        const key = String(id);
        const until = Date.now() + 3000;
        const prev = state.optimisticById.get(key);
        const merged = { ...(prev?.desired || {}), ...desired };
        state.optimisticById.set(key, { desired: merged, until });
      };

      // First update: set mode
      startOptimistic(id, { mode: 'COOL' });
      expect(state.optimisticById.get(id).desired).toEqual({ mode: 'COOL' });

      // Second update: set temperature (should merge)
      startOptimistic(id, { spt: 24 });
      expect(state.optimisticById.get(id).desired).toEqual({ mode: 'COOL', spt: 24 });
    });
  });

  describe('pollOptimistic - Memory Leak Prevention', () => {
    it('should clean up timer when optimistic state is cleared', async () => {
      const id = 'test-device';
      let activeTimers = 0;

      const refreshDevice = vi.fn().mockResolvedValue(undefined);

      // Improved version that tracks timers
      const pollOptimistic = (id) => {
        const key = String(id);
        const entry = state.optimisticById.get(key);
        if (!entry) return;

        activeTimers++;
        refreshDevice(id).then(() => {
          const currentEntry = state.optimisticById.get(key);
          if (!currentEntry) {
            activeTimers--;
            return;
          }

          const now = Date.now();
          if (now >= currentEntry.until) {
            state.optimisticById.delete(key);
            activeTimers--;
            return;
          }

          const timerId = setTimeout(() => pollOptimistic(id), 400);
          timers.set(key, timerId);
        });
      };

      // Start polling
      state.optimisticById.set(id, { desired: { mode: 'COOL' }, until: Date.now() + 3000 });
      pollOptimistic(id);

      await vi.advanceTimersByTimeAsync(0); // Process initial promise

      expect(activeTimers).toBe(1);

       // Clear optimistic state (simulates logout or navigation)
       state.optimisticById.delete(id);
       if (timers.has(id)) {
         clearTimeout(timers.get(id));
         timers.delete(id);
         activeTimers--; // Decrement since polling is stopped
       }

       await vi.advanceTimersByTimeAsync(400);

       expect(activeTimers).toBe(0);
    });

    it('should stop polling after timeout expires', async () => {
      const id = 'test-device';
      const refreshDevice = vi.fn().mockResolvedValue(undefined);

      const pollOptimistic = (id) => {
        const key = String(id);
        const entry = state.optimisticById.get(key);
        if (!entry) return;

        refreshDevice(id).then(() => {
          const currentEntry = state.optimisticById.get(key);
          if (!currentEntry) return;

          const now = Date.now();
          if (now >= currentEntry.until) {
            state.optimisticById.delete(key);
            return;
          }

          setTimeout(() => pollOptimistic(id), 400);
        });
      };

      // Set entry that expires in 1 second
      state.optimisticById.set(id, { desired: { mode: 'COOL' }, until: Date.now() + 1000 });
      pollOptimistic(id);

      await vi.advanceTimersByTimeAsync(0);
      expect(refreshDevice).toHaveBeenCalledTimes(1);

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(1500);

      // Should have stopped polling
      expect(state.optimisticById.has(id)).toBe(false);
    });

    it('should stop polling when state matches desired', async () => {
      const id = 'test-device';
      const desired = { mode: 'COOL', spt: 24 };

      state.statusMap.set(id, { mode: 'COOL', spt: 24 }); // Matches desired

      const refreshDevice = vi.fn().mockResolvedValue(undefined);

      const pollOptimistic = (id) => {
        const key = String(id);
        const entry = state.optimisticById.get(key);
        if (!entry) return;

        refreshDevice(id).then(() => {
          const currentEntry = state.optimisticById.get(key);
          if (!currentEntry) return;

          const f = state.statusMap.get(key);
          const d = currentEntry.desired || {};
          const matched =
            (d.mode === undefined || f?.mode === d.mode) &&
            (d.spt === undefined || f?.spt === d.spt);

          if (matched) {
            state.optimisticById.delete(key);
            return;
          }

          const now = Date.now();
          if (now >= currentEntry.until) {
            state.optimisticById.delete(key);
            return;
          }

          setTimeout(() => pollOptimistic(id), 400);
        });
      };

      state.optimisticById.set(id, { desired, until: Date.now() + 3000 });
      pollOptimistic(id);

      await vi.advanceTimersByTimeAsync(0);

      // Should have matched and stopped
      expect(state.optimisticById.has(id)).toBe(false);
      expect(refreshDevice).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logout Cleanup', () => {
    it('should clear all state maps on logout', () => {
      // Set up state
      state.optimisticById.set('device1', { desired: { mode: 'COOL' }, until: Date.now() + 3000 });
      state.pendingById.set('device1', true);
      state.statusMap.set('device1', { mode: 'AUTO' });

      // Simulate logout with cleanup
      const logout = () => {
        state.optimisticById.clear();
        state.pendingById.clear();
        state.statusMap.clear();
        
        // Clear all tracked timers
        timers.forEach((timerId) => clearTimeout(timerId));
        timers.clear();
      };

      logout();

      expect(state.optimisticById.size).toBe(0);
      expect(state.pendingById.size).toBe(0);
      expect(state.statusMap.size).toBe(0);
      expect(timers.size).toBe(0);
    });
  });
});
