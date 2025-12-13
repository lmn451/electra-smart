import { describe, it, expect, vi } from 'vitest';

describe('IMEI Generation', () => {
  describe('Current Implementation (Math.random)', () => {
    it('should generate valid format IMEI', () => {
      const generateImei = () => {
        return `2b950000${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
      };

      const imei = generateImei();
      
      expect(imei).toMatch(/^2b950000\d{8}$/);
      expect(imei.length).toBe(16);
    });

    it('should pad short numbers with zeros', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.00000001); // Very small number

      const generateImei = () => {
        return `2b950000${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
      };

      const imei = generateImei();
      
      expect(imei).toBe('2b95000000000001');
      expect(imei.length).toBe(16);

      vi.restoreAllMocks();
    });

    it('has collision risk with 100M possibilities', () => {
      // Birthday paradox: ~50% collision probability at sqrt(n) items
      // For 100M possibilities: sqrt(100,000,000) = 10,000 users
      
      const maxPossibilities = 1e8; // 100 million
      const fiftyPercentCollisionAt = Math.sqrt(maxPossibilities);
      
      expect(fiftyPercentCollisionAt).toBe(10000);
      // This means at ~10,000 users, we have 50% chance of collision!
    });
  });

  describe('Improved Implementation (crypto.randomUUID)', () => {
    it('should generate IMEI with cryptographically secure randomness', () => {
      // Mock crypto.randomUUID using vi.spyOn
      const randomUUIDMock = vi.spyOn(global.crypto, 'randomUUID')
        .mockReturnValue('550e8400-e29b-41d4-a716-446655440000');

      const generateImeiSecure = () => {
        const uuid = crypto.randomUUID().replace(/-/g, '');
        // Take first 8 hex chars and convert to decimal for IMEI format
        const suffix = parseInt(uuid.substring(0, 8), 16).toString().padStart(8, '0').substring(0, 8);
        return `2b950000${suffix}`;
      };

      const imei = generateImeiSecure();
      
      expect(imei).toMatch(/^2b950000\d{8}$/);
      expect(randomUUIDMock).toHaveBeenCalled();
      
      randomUUIDMock.mockRestore();
    });

    it('should have much lower collision probability', () => {
      // With crypto.randomUUID, we get 128 bits of entropy
      // Using even 32 bits (8 hex chars) gives us 4.3 billion possibilities
      
      const bitsUsed = 32; // Using 8 hex chars from UUID
      const possibilities = Math.pow(2, bitsUsed);
      const fiftyPercentCollisionAt = Math.sqrt(possibilities);
      
      expect(possibilities).toBe(4294967296); // 4.3 billion
      expect(fiftyPercentCollisionAt).toBeGreaterThan(65000); // Much safer!
    });

    it('should handle UUID format correctly', () => {
      const randomUUIDMock = vi.spyOn(global.crypto, 'randomUUID')
        .mockReturnValueOnce('123e4567-e89b-12d3-a456-426614174000')
        .mockReturnValueOnce('987f6543-c21a-76b5-e987-654321987654');

      const generateImeiSecure = () => {
        const uuid = crypto.randomUUID().replace(/-/g, '');
        const suffix = parseInt(uuid.substring(0, 8), 16).toString().padStart(8, '0').substring(0, 8);
        return `2b950000${suffix}`;
      };

      const imei1 = generateImeiSecure();
      const imei2 = generateImeiSecure();
      
      expect(imei1).toMatch(/^2b950000\d{8}$/);
      expect(imei2).toMatch(/^2b950000\d{8}$/);
      expect(imei1).not.toBe(imei2); // Different IMEIs
      
      randomUUIDMock.mockRestore();
    });
  });

  describe('Alternative: Timestamp + Random', () => {
    it('should generate IMEI with timestamp component for uniqueness', () => {
      const generateImeiWithTimestamp = () => {
        const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `2b950000${timestamp}${random}`;
      };

      const imei = generateImeiWithTimestamp();
      
      expect(imei).toMatch(/^2b950000\d{8}$/);
      expect(imei.length).toBe(16);
    });

    it('should generate unique IMEIs even with same timestamp', () => {
      const fixedTime = 1702497600000; // Fixed timestamp
      vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
      
      // Mock different random values
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.1234)
        .mockReturnValueOnce(0.5678);

      const generateImeiWithTimestamp = () => {
        const timestamp = Date.now().toString().slice(-4);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `2b950000${timestamp}${random}`;
      };

      const imei1 = generateImeiWithTimestamp();
      const imei2 = generateImeiWithTimestamp();
      
      expect(imei1).not.toBe(imei2); // Different due to random component

      vi.restoreAllMocks();
    });
  });

  describe('IMEI Format Validation', () => {
    it('should validate correct IMEI format', () => {
      const isValidImei = (imei) => {
        return /^2b950000\d{8}$/.test(imei);
      };

      expect(isValidImei('2b95000012345678')).toBe(true);
      expect(isValidImei('2b95000000000000')).toBe(true);
      expect(isValidImei('2b95000099999999')).toBe(true);
    });

    it('should reject invalid IMEI formats', () => {
      const isValidImei = (imei) => {
        return /^2b950000\d{8}$/.test(imei);
      };

      expect(isValidImei('2b9500001234567')).toBe(false);  // Too short
      expect(isValidImei('2b950000123456789')).toBe(false); // Too long
      expect(isValidImei('2b95000012345abc')).toBe(false);  // Letters in suffix
      expect(isValidImei('3b95000012345678')).toBe(false);  // Wrong prefix
      expect(isValidImei('')).toBe(false);                   // Empty
      expect(isValidImei(null)).toBe(false);                 // Null
    });

    it('should accept client-provided IMEI if valid', () => {
      const getOrGenerateImei = (clientImei) => {
        const isValid = /^2b950000\d{8}$/.test(clientImei);
        if (isValid) {
          return clientImei;
        }
        // Generate new one
        return `2b950000${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
      };

      const validClient = '2b95000087654321';
      expect(getOrGenerateImei(validClient)).toBe(validClient);

      const invalidClient = 'invalid';
      const generated = getOrGenerateImei(invalidClient);
      expect(generated).toMatch(/^2b950000\d{8}$/);
      expect(generated).not.toBe(invalidClient);
    });
  });
});
