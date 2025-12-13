import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Temperature Validation', () => {
  let mockInput;

  beforeEach(() => {
    mockInput = {
      value: '24',
      min: '10',
      max: '35',
    };
  });

  describe('stepTemp', () => {
    it('should increment temperature within bounds', () => {
      const stepTemp = (input, delta) => {
        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const cur = Number(input.value || 24);
        const next = Math.min(max, Math.max(min, cur + delta));
        input.value = String(next);
        return next;
      };

      mockInput.value = '24';
      const result = stepTemp(mockInput, +1);
      expect(result).toBe(25);
      expect(mockInput.value).toBe('25');
    });

    it('should decrement temperature within bounds', () => {
      const stepTemp = (input, delta) => {
        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const cur = Number(input.value || 24);
        const next = Math.min(max, Math.max(min, cur + delta));
        input.value = String(next);
        return next;
      };

      mockInput.value = '24';
      const result = stepTemp(mockInput, -1);
      expect(result).toBe(23);
      expect(mockInput.value).toBe('23');
    });

    it('should clamp at maximum value', () => {
      const stepTemp = (input, delta) => {
        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const cur = Number(input.value || 24);
        const next = Math.min(max, Math.max(min, cur + delta));
        input.value = String(next);
        return next;
      };

      mockInput.value = '35';
      const result = stepTemp(mockInput, +1);
      expect(result).toBe(35); // Stays at max
      expect(mockInput.value).toBe('35');
    });

    it('should clamp at minimum value', () => {
      const stepTemp = (input, delta) => {
        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const cur = Number(input.value || 24);
        const next = Math.min(max, Math.max(min, cur + delta));
        input.value = String(next);
        return next;
      };

      mockInput.value = '10';
      const result = stepTemp(mockInput, -1);
      expect(result).toBe(10); // Stays at min
      expect(mockInput.value).toBe('10');
    });

    it('should handle invalid input by using fallback 24', () => {
      const stepTemp = (input, delta) => {
        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const cur = Number(input.value) || 24; // Fallback to 24 if invalid
        const next = Math.min(max, Math.max(min, cur + delta));
        input.value = String(next);
        return next;
      };

      mockInput.value = 'abc'; // Invalid
      const result = stepTemp(mockInput, +1);
      expect(result).toBe(25); // Uses fallback 24 + 1
    });

    it('should handle empty input by using fallback 24', () => {
      const stepTemp = (input, delta) => {
        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const cur = Number(input.value || 24);
        const next = Math.min(max, Math.max(min, cur + delta));
        input.value = String(next);
        return next;
      };

      mockInput.value = '';
      const result = stepTemp(mockInput, +1);
      expect(result).toBe(25);
    });
  });

  describe('applyTemp - Improved with validation', () => {
    it('should validate and clamp numeric input', () => {
      const applyTemp = (input) => {
        const value = input.value.trim();
        
        // Reject non-numeric input
        if (!/^-?\d+$/.test(value)) {
          return { valid: false, error: 'Temperature must be a number' };
        }

        const n = parseInt(value, 10);
        if (!Number.isFinite(n)) {
          return { valid: false, error: 'Invalid temperature' };
        }

        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const clamped = Math.min(max, Math.max(min, n));

        if (clamped !== n) {
          input.value = String(clamped);
          return { valid: true, clamped: true, value: clamped };
        }

        return { valid: true, clamped: false, value: n };
      };

      mockInput.value = '28';
      const result = applyTemp(mockInput);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(28);
    });

    it('should reject non-numeric input', () => {
      const applyTemp = (input) => {
        const value = input.value.trim();
        
        if (!/^-?\d+$/.test(value)) {
          return { valid: false, error: 'Temperature must be a number' };
        }

        const n = parseInt(value, 10);
        if (!Number.isFinite(n)) {
          return { valid: false, error: 'Invalid temperature' };
        }

        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const clamped = Math.min(max, Math.max(min, n));

        if (clamped !== n) {
          input.value = String(clamped);
          return { valid: true, clamped: true, value: clamped };
        }

        return { valid: true, clamped: false, value: n };
      };

      mockInput.value = 'abc';
      const result = applyTemp(mockInput);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Temperature must be a number');
    });

    it('should clamp out-of-range values and update input', () => {
      const applyTemp = (input) => {
        const value = input.value.trim();
        
        if (!/^-?\d+$/.test(value)) {
          return { valid: false, error: 'Temperature must be a number' };
        }

        const n = parseInt(value, 10);
        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const clamped = Math.min(max, Math.max(min, n));

        if (clamped !== n) {
          input.value = String(clamped);
          return { valid: true, clamped: true, value: clamped };
        }

        return { valid: true, clamped: false, value: n };
      };

      mockInput.value = '50'; // Above max
      const result = applyTemp(mockInput);
      expect(result.valid).toBe(true);
      expect(result.clamped).toBe(true);
      expect(result.value).toBe(35);
      expect(mockInput.value).toBe('35');
    });

    it('should clamp negative values to minimum', () => {
      const applyTemp = (input) => {
        const value = input.value.trim();
        
        if (!/^-?\d+$/.test(value)) {
          return { valid: false, error: 'Temperature must be a number' };
        }

        const n = parseInt(value, 10);
        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const clamped = Math.min(max, Math.max(min, n));

        if (clamped !== n) {
          input.value = String(clamped);
          return { valid: true, clamped: true, value: clamped };
        }

        return { valid: true, clamped: false, value: n };
      };

      mockInput.value = '5'; // Below min
      const result = applyTemp(mockInput);
      expect(result.valid).toBe(true);
      expect(result.clamped).toBe(true);
      expect(result.value).toBe(10);
    });

    it('should reject symbols and special characters', () => {
      const applyTemp = (input) => {
        const value = input.value.trim();
        
        if (!/^-?\d+$/.test(value)) {
          return { valid: false, error: 'Temperature must be a number' };
        }

        const n = parseInt(value, 10);
        if (!Number.isFinite(n)) {
          return { valid: false, error: 'Invalid temperature' };
        }

        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const clamped = Math.min(max, Math.max(min, n));

        return { valid: true, clamped: clamped !== n, value: clamped };
      };

      const testCases = ['!@#', '24.5', '24°', '24C', 'twenty-four'];
      
      testCases.forEach((testValue) => {
        mockInput.value = testValue;
        const result = applyTemp(mockInput);
        expect(result.valid).toBe(false);
      });
    });

    it('should handle whitespace correctly', () => {
      const applyTemp = (input) => {
        const value = input.value.trim();
        
        if (!/^-?\d+$/.test(value)) {
          return { valid: false, error: 'Temperature must be a number' };
        }

        const n = parseInt(value, 10);
        const min = Number(input.min || 10);
        const max = Number(input.max || 35);
        const clamped = Math.min(max, Math.max(min, n));

        return { valid: true, clamped: clamped !== n, value: clamped };
      };

      mockInput.value = '  24  ';
      const result = applyTemp(mockInput);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(24);
    });
  });
});
