/**
 * Tests for Pagination Validation Utilities
 *
 * Comprehensive security testing for pagination parameter validation
 * including SQL injection attempts, DoS vectors, and type coercion edge cases.
 */

import {
  validateLimit,
  validateOffset,
  validatePaginationParams,
  validatePaginationWithLogging,
  isPaginationValid,
  PAGINATION_DEFAULTS
} from '../paginationValidation';

describe('Pagination Validation Utilities', () => {
  describe('validateLimit', () => {
    describe('valid inputs', () => {
      it('should accept valid integer limits', () => {
        expect(validateLimit(1)).toBe(1);
        expect(validateLimit(50)).toBe(50);
        expect(validateLimit(100)).toBe(100);
        expect(validateLimit(200)).toBe(200);
      });

      it('should accept string representations of valid numbers', () => {
        expect(validateLimit('1')).toBe(1);
        expect(validateLimit('50')).toBe(50);
        expect(validateLimit('100')).toBe(100);
        expect(validateLimit('200')).toBe(200);
      });

      it('should handle float inputs by truncating', () => {
        expect(validateLimit(1.5)).toBe(1);
        expect(validateLimit(50.9)).toBe(50);
        expect(validateLimit(99.999)).toBe(99);
      });

      it('should use custom min/max/default values', () => {
        expect(validateLimit(500, { max: 1000 })).toBe(500);
        expect(validateLimit(5, { min: 10, default: 20 })).toBe(10);
        expect(validateLimit('invalid', { default: 100 })).toBe(100);
      });
    });

    describe('boundary clamping', () => {
      it('should clamp to minimum (1)', () => {
        expect(validateLimit(0)).toBe(1);
        expect(validateLimit(-1)).toBe(1);
        expect(validateLimit(-10)).toBe(1);
        expect(validateLimit(-999999)).toBe(1);
      });

      it('should clamp to maximum (200)', () => {
        expect(validateLimit(201)).toBe(200);
        expect(validateLimit(300)).toBe(200);
        expect(validateLimit(999999)).toBe(200);
        expect(validateLimit(Number.MAX_SAFE_INTEGER)).toBe(200);
      });

      it('should respect custom boundaries', () => {
        expect(validateLimit(5, { min: 10, max: 100 })).toBe(10);
        expect(validateLimit(150, { min: 10, max: 100 })).toBe(100);
      });
    });

    describe('invalid inputs - fallback to default', () => {
      it('should handle null/undefined', () => {
        expect(validateLimit(null)).toBe(50);
        expect(validateLimit(undefined)).toBe(50);
      });

      it('should handle non-numeric strings', () => {
        expect(validateLimit('abc')).toBe(50);
        expect(validateLimit('xyz123')).toBe(50);
        expect(validateLimit('')).toBe(50);
        expect(validateLimit('   ')).toBe(50);
      });

      it('should handle Infinity and NaN', () => {
        expect(validateLimit(Infinity)).toBe(50);
        expect(validateLimit(-Infinity)).toBe(50);
        expect(validateLimit(NaN)).toBe(50);
      });

      it('should handle objects and arrays', () => {
        expect(validateLimit({})).toBe(50);
        expect(validateLimit([])).toBe(50);
        expect(validateLimit([100])).toBe(100); // parseInt([100]) = 100
        expect(validateLimit({ limit: 100 })).toBe(50);
      });

      it('should handle boolean values', () => {
        expect(validateLimit(true)).toBe(50); // parseInt(true) = NaN
        expect(validateLimit(false)).toBe(50);
      });

      it('should handle functions', () => {
        expect(validateLimit(() => 100)).toBe(50);
      });
    });

    describe('SQL injection prevention', () => {
      it('should sanitize SQL injection attempts', () => {
        expect(validateLimit("'; DROP TABLE customers; --")).toBe(50);
        expect(validateLimit("100; DELETE FROM users")).toBe(100); // parseInt stops at semicolon
        expect(validateLimit("1' OR '1'='1")).toBe(1);
        expect(validateLimit("50--comment")).toBe(50);
        expect(validateLimit("100/*comment*/")).toBe(100);
      });

      it('should sanitize NoSQL injection attempts', () => {
        expect(validateLimit('{"$gt": 0}')).toBe(50);
        expect(validateLimit('[$ne]=null')).toBe(50);
      });
    });

    describe('edge cases', () => {
      it('should handle scientific notation', () => {
        expect(validateLimit('1e2')).toBe(1); // parseInt('1e2', 10) = 1 (stops at 'e')
        expect(validateLimit('5e1')).toBe(5);
      });

      it('should handle hexadecimal strings', () => {
        expect(validateLimit('0x32')).toBe(1); // parseInt('0x32', 10) = 0, clamped to min 1
        expect(validateLimit('0x64')).toBe(1);
      });

      it('should handle mixed numeric/alpha strings', () => {
        expect(validateLimit('50abc')).toBe(50); // parseInt stops at first non-digit
        expect(validateLimit('100xyz')).toBe(100);
      });
    });
  });

  describe('validateOffset', () => {
    describe('valid inputs', () => {
      it('should accept valid integer offsets', () => {
        expect(validateOffset(0)).toBe(0);
        expect(validateOffset(100)).toBe(100);
        expect(validateOffset(1000)).toBe(1000);
        expect(validateOffset(999999)).toBe(999999);
      });

      it('should accept string representations of valid numbers', () => {
        expect(validateOffset('0')).toBe(0);
        expect(validateOffset('100')).toBe(100);
        expect(validateOffset('1000')).toBe(1000);
      });

      it('should handle float inputs by truncating', () => {
        expect(validateOffset(100.5)).toBe(100);
        expect(validateOffset(999.9)).toBe(999);
      });
    });

    describe('boundary clamping', () => {
      it('should clamp to minimum (0)', () => {
        expect(validateOffset(-1)).toBe(0);
        expect(validateOffset(-10)).toBe(0);
        expect(validateOffset(-999999)).toBe(0);
      });

      it('should clamp to maximum (1000000) to prevent DoS', () => {
        expect(validateOffset(1000001)).toBe(1000000);
        expect(validateOffset(999999999)).toBe(1000000);
        expect(validateOffset(Number.MAX_SAFE_INTEGER)).toBe(1000000);
      });

      it('should respect custom boundaries', () => {
        expect(validateOffset(-10, { min: 0, max: 500 })).toBe(0);
        expect(validateOffset(1000, { min: 0, max: 500 })).toBe(500);
      });
    });

    describe('invalid inputs - fallback to default (0)', () => {
      it('should handle null/undefined', () => {
        expect(validateOffset(null)).toBe(0);
        expect(validateOffset(undefined)).toBe(0);
      });

      it('should handle non-numeric strings', () => {
        expect(validateOffset('abc')).toBe(0);
        expect(validateOffset('')).toBe(0);
      });

      it('should handle Infinity and NaN', () => {
        expect(validateOffset(Infinity)).toBe(0);
        expect(validateOffset(-Infinity)).toBe(0);
        expect(validateOffset(NaN)).toBe(0);
      });

      it('should handle objects and arrays', () => {
        expect(validateOffset({})).toBe(0);
        expect(validateOffset([])).toBe(0);
      });
    });

    describe('SQL injection prevention', () => {
      it('should sanitize SQL injection attempts', () => {
        expect(validateOffset("'; DROP TABLE customers; --")).toBe(0);
        expect(validateOffset("100; DELETE FROM users")).toBe(100);
        expect(validateOffset("0' OR '1'='1")).toBe(0);
      });
    });

    describe('DoS prevention', () => {
      it('should prevent excessive offset values that cause DB performance issues', () => {
        expect(validateOffset(999999999)).toBe(1000000);
        expect(validateOffset(Number.MAX_SAFE_INTEGER)).toBe(1000000);
      });
    });
  });

  describe('validatePaginationParams', () => {
    it('should validate both limit and offset', () => {
      const result = validatePaginationParams({ limit: 50, offset: 100 });
      expect(result).toEqual({ limit: 50, offset: 100 });
    });

    it('should use defaults for missing parameters', () => {
      const result = validatePaginationParams({});
      expect(result).toEqual({ limit: 50, offset: 0 });
    });

    it('should sanitize both parameters', () => {
      const result = validatePaginationParams({
        limit: 'abc',
        offset: 'xyz'
      });
      expect(result).toEqual({ limit: 50, offset: 0 });
    });

    it('should clamp both parameters', () => {
      const result = validatePaginationParams({
        limit: 999999,
        offset: -100
      });
      expect(result).toEqual({ limit: 200, offset: 0 });
    });

    it('should handle SQL injection in both parameters', () => {
      const result = validatePaginationParams({
        limit: "'; DROP TABLE--",
        offset: "'; DELETE FROM users--"
      });
      expect(result).toEqual({ limit: 50, offset: 0 });
    });

    it('should respect custom configuration', () => {
      const result = validatePaginationParams(
        { limit: 500, offset: 2000 },
        {
          limit: { max: 1000, default: 100 },
          offset: { max: 5000, default: 0 }
        }
      );
      expect(result).toEqual({ limit: 500, offset: 2000 });
    });

    it('should handle undefined options object', () => {
      const result = validatePaginationParams();
      expect(result).toEqual({ limit: 50, offset: 0 });
    });

    it('should handle null options object', () => {
      const result = validatePaginationParams(null);
      // null?.limit = undefined, null?.offset = undefined
      expect(result).toEqual({ limit: 50, offset: 0 });
    });
  });

  describe('validatePaginationWithLogging', () => {
    let consoleWarnSpy;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should not log when values are valid', () => {
      validatePaginationWithLogging({ limit: 50, offset: 100 }, {}, 'testContext');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log when limit is sanitized', () => {
      validatePaginationWithLogging({ limit: 999999, offset: 100 }, {}, 'testContext');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Security]'),
        expect.objectContaining({
          original: { limit: 999999, offset: 100 },
          validated: { limit: 200, offset: 100 }
        })
      );
    });

    it('should log when offset is sanitized', () => {
      validatePaginationWithLogging({ limit: 50, offset: -100 }, {}, 'testContext');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Security]'),
        expect.objectContaining({
          original: { limit: 50, offset: -100 },
          validated: { limit: 50, offset: 0 }
        })
      );
    });

    it('should log when both are sanitized', () => {
      validatePaginationWithLogging({ limit: 'abc', offset: 'xyz' }, {}, 'testContext');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should include context in log message', () => {
      validatePaginationWithLogging({ limit: 999 }, {}, 'fetchCustomers');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fetchCustomers'),
        expect.any(Object)
      );
    });

    it('should include timestamp', () => {
      validatePaginationWithLogging({ limit: 999 }, {}, 'testContext');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('isPaginationValid', () => {
    it('should return valid for correct parameters', () => {
      const result = isPaginationValid({ limit: 50, offset: 100 });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return invalid for out-of-range limit', () => {
      const result = isPaginationValid({ limit: 999 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Limit must be between');
    });

    it('should return invalid for out-of-range offset', () => {
      const result = isPaginationValid({ offset: -10 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Offset must be between');
    });

    it('should return invalid for non-numeric limit', () => {
      const result = isPaginationValid({ limit: 'abc' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid limit');
    });

    it('should return invalid for non-numeric offset', () => {
      const result = isPaginationValid({ offset: 'xyz' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid offset');
    });

    it('should return multiple errors for multiple invalid parameters', () => {
      const result = isPaginationValid({ limit: 'abc', offset: -10 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should respect custom config', () => {
      const result = isPaginationValid(
        { limit: 500 },
        { limit: { max: 1000 } }
      );
      expect(result.isValid).toBe(true);
    });

    it('should handle undefined parameters gracefully', () => {
      const result = isPaginationValid({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('PAGINATION_DEFAULTS constant', () => {
    it('should have correct default values', () => {
      expect(PAGINATION_DEFAULTS.MIN_LIMIT).toBe(1);
      expect(PAGINATION_DEFAULTS.MAX_LIMIT).toBe(200);
      expect(PAGINATION_DEFAULTS.DEFAULT_LIMIT).toBe(50);
      expect(PAGINATION_DEFAULTS.MIN_OFFSET).toBe(0);
      expect(PAGINATION_DEFAULTS.MAX_OFFSET).toBe(1000000);
      expect(PAGINATION_DEFAULTS.DEFAULT_OFFSET).toBe(0);
    });
  });

  describe('real-world attack scenarios', () => {
    it('should prevent DoS via large limit', () => {
      const malicious = { limit: 999999999, offset: 0 };
      const result = validatePaginationParams(malicious);
      expect(result.limit).toBe(200); // Clamped to max
    });

    it('should prevent DoS via large offset', () => {
      const malicious = { limit: 50, offset: 999999999 };
      const result = validatePaginationParams(malicious);
      expect(result.offset).toBe(1000000); // Clamped to max
    });

    it('should prevent SQL injection via limit', () => {
      const malicious = { limit: "100'; DROP TABLE customers; --" };
      const result = validatePaginationParams(malicious);
      expect(result.limit).toBe(100); // Sanitized to numeric prefix
    });

    it('should prevent type coercion attacks', () => {
      const malicious = { limit: { valueOf: () => 999 }, offset: { toString: () => '999' } };
      const result = validatePaginationParams(malicious);
      // parseInt will attempt toString conversion on objects
      // Objects with custom toString may return numeric strings
      expect(result.limit).toBe(50); // Object with valueOf rejected by parseInt
      expect(result.offset).toBe(999); // parseInt calls toString() which returns '999', but it's within bounds
    });

    it('should handle null byte injection', () => {
      const malicious = { limit: "100\x00DROP", offset: "50\x00DELETE" };
      const result = validatePaginationParams(malicious);
      expect(result.limit).toBe(100);
      expect(result.offset).toBe(50);
    });

    it('should handle unicode attacks', () => {
      const malicious = { limit: "100\u0000", offset: "50\u202E" };
      const result = validatePaginationParams(malicious);
      expect(result.limit).toBe(100);
      expect(result.offset).toBe(50);
    });
  });
});
