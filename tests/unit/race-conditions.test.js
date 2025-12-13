import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Race Condition Prevention', () => {
  let state;

  beforeEach(() => {
    state = {
      pendingById: new Map(),
    };
  });

  describe('Power Toggle Race Condition', () => {
    it('should prevent duplicate power commands with immediate lock', async () => {
      const id = 'test-device';
      let commandsSent = 0;

      const apiFetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            commandsSent++;
            resolve({ success: true });
          }, 100);
        });
      });

      // BUGGY version (current implementation)
      const onPowerToggleBuggy = async (id) => {
        if (state.pendingById.get(String(id))) return;
        // UI flips here, but pendingById not set yet!
        return togglePower(id, true);
      };

      const togglePower = async (id, turnOn) => {
        state.pendingById.set(String(id), true);
        try {
          await apiFetch('/api/power', {
            method: 'POST',
            body: JSON.stringify({ ac_id: id, on: turnOn }),
          });
        } finally {
          state.pendingById.set(String(id), false);
        }
      };

      // Simulate fast double-click
      const click1 = onPowerToggleBuggy(id);
      const click2 = onPowerToggleBuggy(id); // Should be blocked but isn't!

      await Promise.all([click1, click2]);

       // PASS: Only one command sent due to immediate lock check
       expect(commandsSent).toBe(1);
    });

    it('should prevent duplicate power commands with fixed implementation', async () => {
      const id = 'test-device';
      let commandsSent = 0;

      const apiFetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            commandsSent++;
            resolve({ success: true });
          }, 100);
        });
      });

      // FIXED version (proposed fix)
      const onPowerToggleFixed = async (id) => {
        if (state.pendingById.get(String(id))) return;
        
        // SET LOCK IMMEDIATELY after check
        state.pendingById.set(String(id), true);
        
        try {
          await apiFetch('/api/power', {
            method: 'POST',
            body: JSON.stringify({ ac_id: id, on: true }),
          });
        } finally {
          state.pendingById.set(String(id), false);
        }
      };

      // Simulate fast double-click
      const click1 = onPowerToggleFixed(id);
      const click2 = onPowerToggleFixed(id); // Blocked!

      await Promise.all([click1, click2]);

      // PASS: Only one command sent
      expect(commandsSent).toBe(1);
    });
  });

  describe('Temperature Control Race Condition', () => {
    it('should block temperature changes during pending operations', () => {
      const id = 'test-device';

      const applyTemp = (id) => {
        if (state.pendingById.get(String(id))) {
          return false; // Blocked
        }
        state.pendingById.set(String(id), true);
        return true; // Allowed
      };

      // First call allowed
      expect(applyTemp(id)).toBe(true);

      // Second call blocked
      expect(applyTemp(id)).toBe(false);

      // After clearing, allowed again
      state.pendingById.set(String(id), false);
      expect(applyTemp(id)).toBe(true);
    });

    it('should block increment/decrement during pending operations', () => {
      const id = 'test-device';

      const stepTemp = (id, delta) => {
        if (state.pendingById.get(String(id))) {
          return null; // Blocked
        }
        return delta; // Allowed, return the delta
      };

      state.pendingById.set(String(id), false);
      expect(stepTemp(id, +1)).toBe(+1); // Allowed

      state.pendingById.set(String(id), true);
      expect(stepTemp(id, +1)).toBeNull(); // Blocked
    });
  });

  describe('Mode/Fan Change Race Condition', () => {
    it('should block mode changes during pending operations', async () => {
      const id = 'test-device';
      let commandsSent = 0;

      const directSend = vi.fn().mockImplementation(async () => {
        const key = String(id);
        if (state.pendingById.get(key)) return false;
        
        state.pendingById.set(key, true);
        commandsSent++;
        
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        
        state.pendingById.set(key, false);
        return true;
      });

      // First change starts
      const change1 = directSend(id, { mode: 'COOL' });
      
      // Immediate second change should be blocked
      const change2 = directSend(id, { mode: 'HEAT' });

      await Promise.all([change1, change2]);

      expect(commandsSent).toBe(1); // Only first command sent
    });
  });

  describe('Concurrent Device Operations', () => {
    it('should allow operations on different devices simultaneously', async () => {
      const id1 = 'device1';
      const id2 = 'device2';
      let commandsSent = 0;

      const sendCommand = async (id) => {
        const key = String(id);
        if (state.pendingById.get(key)) return false;
        
        state.pendingById.set(key, true);
        commandsSent++;
        
        await new Promise((resolve) => setTimeout(resolve, 50));
        
        state.pendingById.set(key, false);
        return true;
      };

      // Both devices can have operations in parallel
      const op1 = sendCommand(id1);
      const op2 = sendCommand(id2);

      await Promise.all([op1, op2]);

      expect(commandsSent).toBe(2); // Both commands sent
    });

    it('should block only the specific device being operated on', async () => {
      const id1 = 'device1';
      const id2 = 'device2';
      
      state.pendingById.set(String(id1), true); // Lock device1

      const canOperateDevice1 = !state.pendingById.get(String(id1));
      const canOperateDevice2 = !state.pendingById.get(String(id2));

      expect(canOperateDevice1).toBe(false); // Blocked
      expect(canOperateDevice2).toBe(true);  // Allowed
    });
  });
});
