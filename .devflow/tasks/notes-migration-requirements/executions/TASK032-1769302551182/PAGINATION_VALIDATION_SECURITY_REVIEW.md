# Pagination Parameter Validation Security Review

**Task:** [REVIEW] Missing pagination parameter validation allows potential NoSQL injection
**Date:** 2026-01-24
**Status:** ⚠️ CRITICAL VULNERABILITIES IDENTIFIED

## Executive Summary

This security review identifies **critical vulnerabilities** in pagination parameter validation across the codebase. While the application does not use NoSQL databases directly (it uses PostgreSQL via Supabase), **the lack of proper input validation for pagination parameters can still lead to serious security issues** including:

1. **SQL Injection via Parameter Tampering** - Unvalidated limit/offset values passed to backend API
2. **Denial of Service (DoS)** - Attackers can request massive datasets by manipulating pagination
3. **Resource Exhaustion** - Large offset values can cause expensive database queries
4. **Integer Overflow** - Missing type coercion can lead to unexpected behavior

## Vulnerability Analysis

### 1. CRITICAL: Missing Type Validation (SQL Injection Risk)

**Affected Files:**
- `src/api/customers.js` - lines 53-54, 220-222
- `src/api/notes.js` - lines 194-195, 227-228, 260-261
- `src/api/links.js` - lines 90-91
- `src/api/projects.js` - lines 66-70, 114-119

**Current Implementation (VULNERABLE):**
```javascript
// customers.js:53-54
const queryParams = {
    limit: options.limit || 50,
    offset: options.offset || 0,
    include_related: options.include_related !== false
};

// notes.js:194-195
const queryParams = {};
if (options.limit) queryParams.limit = options.limit;
if (options.offset) queryParams.offset = options.offset;

// links.js:90-91
if (filters.limit) params.limit = filters.limit;
if (filters.offset) params.offset = filters.offset;
```

**Vulnerability:**
- No type checking - accepts strings, objects, arrays, or any value
- No range validation - accepts negative numbers, Infinity, NaN
- Values passed directly to query parameters without sanitization
- Could inject malicious values: `limit: "9999999"`, `offset: "-1"`, `limit: "'; DROP TABLE--"`

**Example Attack Vector:**
```javascript
// Attacker modifies request
fetchCustomers({
    limit: "999999999",  // String instead of number - causes DoS
    offset: "'; DROP TABLE customers; --"  // SQL injection attempt
});

// Another attack
fetchNotesByProject(projectId, {
    limit: Infinity,  // Causes backend to crash or timeout
    offset: -1  // May bypass pagination logic
});
```

### 2. HIGH: Inconsistent Validation Patterns

**Partial Protection Found:**
- `src/api/customersBackend.js:67-68` - Has proper validation:
  ```javascript
  limit: Math.min(Math.max(limit, 1), 200),
  offset: Math.max(offset, 0)
  ```

- `src/api/projects.js:67, 115` - Has max limit but no type checking:
  ```javascript
  params.append('limit', Math.min(options.limit, 200)); // Max 200
  ```

**Problem:**
- Only 2 out of 7 API files have ANY validation
- Even those with validation are incomplete (missing type coercion)
- No centralized validation utility - each file implements differently

### 3. MEDIUM: Resource Exhaustion via Large Offsets

**Current Behavior:**
```javascript
// No validation on offset size
fetchCustomers({ offset: 999999999, limit: 200 });
```

**Impact:**
- PostgreSQL must skip 999,999,999 rows before returning results
- Extremely expensive `OFFSET` operation in SQL
- Can tie up database connections and CPU
- Causes timeouts and poor user experience

**Known Issue:**
- Backend API has max limits (200 for customers) but frontend doesn't enforce
- Attackers can still send large offsets through API manipulation
- No client-side protection to prevent accidental large offsets

### 4. LOW: Integer Overflow & Type Coercion Issues

**Potential Issues:**
```javascript
// What happens with these values?
fetchCustomers({ limit: 2.5 });  // Float instead of integer
fetchCustomers({ limit: "50x" }); // String with non-numeric chars
fetchCustomers({ limit: {} });    // Object
fetchCustomers({ limit: [] });    // Array
fetchCustomers({ limit: null });  // Null (currently falls back to default)
```

**Current Behavior:**
- No explicit `parseInt()` or type checking
- Relies on JavaScript's loose typing and backend validation
- Could produce unexpected query parameters
- May cause backend errors or unexpected behavior

## Security Impact Assessment

### Severity: **CRITICAL** 🔴

| Risk Category | Severity | Likelihood | Impact |
|--------------|----------|------------|---------|
| SQL Injection | High | Medium | Critical |
| DoS Attack | High | High | High |
| Resource Exhaustion | Medium | High | Medium |
| Data Breach | Low | Low | Critical |

**Reasoning:**
1. **SQL Injection:** While PostgreSQL with parameterized queries is safer than NoSQL, unvalidated parameters can still be exploited if backend has vulnerabilities
2. **DoS is HIGHLY LIKELY:** Easy to exploit via browser dev tools or API clients
3. **Resource Exhaustion:** Large offsets are a known PostgreSQL performance issue
4. **Currently Mitigated By:** Backend API likely has validation, but defense-in-depth requires frontend validation too

## Recommended Fixes

### Priority 1: Create Centralized Pagination Validator (IMMEDIATE)

**Create:** `src/utils/paginationValidation.js`

```javascript
/**
 * Pagination Validation Utilities
 * Prevents SQL injection, DoS, and resource exhaustion attacks
 */

/**
 * Safe pagination parameter defaults
 */
export const PAGINATION_DEFAULTS = {
  MIN_LIMIT: 1,
  MAX_LIMIT: 200,
  DEFAULT_LIMIT: 50,
  MIN_OFFSET: 0,
  MAX_OFFSET: 1000000, // Prevent excessive offset-based DoS
  DEFAULT_OFFSET: 0
};

/**
 * Validates and sanitizes limit parameter
 * @param {any} limit - Raw limit value
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum allowed value (default: 1)
 * @param {number} options.max - Maximum allowed value (default: 200)
 * @param {number} options.default - Default value if invalid (default: 50)
 * @returns {number} Validated and sanitized limit
 */
export function validateLimit(limit, options = {}) {
  const {
    min = PAGINATION_DEFAULTS.MIN_LIMIT,
    max = PAGINATION_DEFAULTS.MAX_LIMIT,
    default: defaultValue = PAGINATION_DEFAULTS.DEFAULT_LIMIT
  } = options;

  // Type coercion and validation
  const parsed = parseInt(limit, 10);

  // Check if parsing succeeded
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }

  // Clamp to safe range
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Validates and sanitizes offset parameter
 * @param {any} offset - Raw offset value
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum allowed value (default: 0)
 * @param {number} options.max - Maximum allowed value (default: 1000000)
 * @param {number} options.default - Default value if invalid (default: 0)
 * @returns {number} Validated and sanitized offset
 */
export function validateOffset(offset, options = {}) {
  const {
    min = PAGINATION_DEFAULTS.MIN_OFFSET,
    max = PAGINATION_DEFAULTS.MAX_OFFSET,
    default: defaultValue = PAGINATION_DEFAULTS.DEFAULT_OFFSET
  } = options;

  // Type coercion and validation
  const parsed = parseInt(offset, 10);

  // Check if parsing succeeded
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }

  // Clamp to safe range
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Validates pagination options object
 * @param {Object} options - Pagination options
 * @param {any} options.limit - Limit parameter
 * @param {any} options.offset - Offset parameter
 * @param {Object} config - Validation configuration
 * @returns {Object} Sanitized pagination options { limit, offset }
 */
export function validatePaginationParams(options = {}, config = {}) {
  return {
    limit: validateLimit(options.limit, config.limit),
    offset: validateOffset(options.offset, config.offset)
  };
}

/**
 * Validates pagination with logging for security monitoring
 * @param {Object} options - Pagination options
 * @param {Object} config - Validation configuration
 * @param {string} context - Context for logging (e.g., 'fetchCustomers')
 * @returns {Object} Sanitized pagination options { limit, offset }
 */
export function validatePaginationWithLogging(options = {}, config = {}, context = 'unknown') {
  const original = { limit: options.limit, offset: options.offset };
  const validated = validatePaginationParams(options, config);

  // Log if values were sanitized (potential attack or bug)
  if (original.limit !== validated.limit || original.offset !== validated.offset) {
    console.warn(`[Security] Pagination parameters sanitized in ${context}:`, {
      original,
      validated,
      timestamp: new Date().toISOString()
    });
  }

  return validated;
}
```

### Priority 2: Update All API Files (URGENT)

**Pattern to apply across all files:**

```javascript
// BEFORE (VULNERABLE)
const queryParams = {
    limit: options.limit || 50,
    offset: options.offset || 0
};

// AFTER (SECURE)
import { validatePaginationParams } from '../utils/paginationValidation';

const validated = validatePaginationParams(options);
const queryParams = {
    limit: validated.limit,
    offset: validated.offset
};
```

**Files to update:**
1. ✅ `src/api/customers.js` - 2 locations (fetchCustomers, searchCustomers)
2. ✅ `src/api/notes.js` - 3 locations (fetchNotesByProject/Task/Customer)
3. ✅ `src/api/links.js` - 1 location (fetchLinks)
4. ✅ `src/api/projects.js` - 2 locations (fetchProjectsForCustomer, fetchProjectsForCustomers)
5. ✅ `src/api/customersBackend.js` - Improve existing validation with utility
6. ✅ `src/api/quickbooksApi.js` - Check if pagination is used

### Priority 3: Add Tests (HIGH)

**Create:** `src/utils/__tests__/paginationValidation.test.js`

```javascript
describe('Pagination Validation', () => {
  describe('validateLimit', () => {
    it('should handle valid integers', () => {
      expect(validateLimit(50)).toBe(50);
      expect(validateLimit(1)).toBe(1);
      expect(validateLimit(200)).toBe(200);
    });

    it('should handle strings with numeric values', () => {
      expect(validateLimit('50')).toBe(50);
      expect(validateLimit('100')).toBe(100);
    });

    it('should clamp to minimum', () => {
      expect(validateLimit(0)).toBe(1);
      expect(validateLimit(-10)).toBe(1);
      expect(validateLimit(-999999)).toBe(1);
    });

    it('should clamp to maximum', () => {
      expect(validateLimit(300)).toBe(200);
      expect(validateLimit(999999)).toBe(200);
      expect(validateLimit(Infinity)).toBe(50); // Falls back to default
    });

    it('should handle invalid inputs', () => {
      expect(validateLimit('abc')).toBe(50); // Default
      expect(validateLimit(null)).toBe(50);
      expect(validateLimit(undefined)).toBe(50);
      expect(validateLimit({})).toBe(50);
      expect(validateLimit([])).toBe(50);
      expect(validateLimit(NaN)).toBe(50);
    });

    it('should handle SQL injection attempts', () => {
      expect(validateLimit("'; DROP TABLE--")).toBe(50);
      expect(validateLimit("100; DELETE FROM users")).toBe(100);
    });

    it('should handle floats', () => {
      expect(validateLimit(2.5)).toBe(2);
      expect(validateLimit(99.9)).toBe(99);
    });
  });

  describe('validateOffset', () => {
    it('should handle valid integers', () => {
      expect(validateOffset(0)).toBe(0);
      expect(validateOffset(100)).toBe(100);
    });

    it('should clamp to minimum', () => {
      expect(validateOffset(-1)).toBe(0);
      expect(validateOffset(-999999)).toBe(0);
    });

    it('should clamp to maximum', () => {
      expect(validateOffset(999999999)).toBe(1000000);
    });

    it('should handle invalid inputs', () => {
      expect(validateOffset('abc')).toBe(0);
      expect(validateOffset(null)).toBe(0);
      expect(validateOffset(Infinity)).toBe(0);
    });
  });

  describe('validatePaginationParams', () => {
    it('should validate both parameters', () => {
      const result = validatePaginationParams({ limit: 50, offset: 100 });
      expect(result).toEqual({ limit: 50, offset: 100 });
    });

    it('should sanitize malicious inputs', () => {
      const result = validatePaginationParams({
        limit: "'; DROP TABLE--",
        offset: -999
      });
      expect(result).toEqual({ limit: 50, offset: 0 });
    });
  });
});
```

### Priority 4: Add JSDoc Documentation (MEDIUM)

Update all API functions to document pagination parameter validation:

```javascript
/**
 * Fetches all customers
 * @param {Object} options - Fetch options
 * @param {number} options.limit - Number of records per page (1-200, default: 50)
 * @param {number} options.offset - Pagination offset (min: 0, max: 1000000, default: 0)
 * @security Pagination parameters are validated and sanitized to prevent injection attacks
 * @returns {Promise<Object>} Customer list with pagination
 */
```

## Implementation Plan

### Phase 1: Immediate Fixes (Today)
1. ✅ Create `paginationValidation.js` utility
2. ✅ Update `customers.js` (highest risk - public-facing)
3. ✅ Update `notes.js` (high usage)
4. ✅ Add basic unit tests

### Phase 2: Complete Rollout (This Week)
5. ✅ Update `projects.js`, `links.js`
6. ✅ Update `customersBackend.js` to use utility
7. ✅ Comprehensive test coverage
8. ✅ Security audit of all API files

### Phase 3: Monitoring (Ongoing)
9. ✅ Add security logging for sanitized parameters
10. ✅ Monitor logs for attack patterns
11. ✅ Review backend API validation alignment

## Additional Recommendations

### 1. Backend Alignment
- Verify backend API has matching validation
- Document backend limits in API contracts
- Ensure frontend and backend limits are synchronized

### 2. Rate Limiting
- Consider adding rate limiting for pagination requests
- Prevent repeated large offset queries from same user
- Implement exponential backoff for failed requests

### 3. Cursor-Based Pagination
- For large datasets, consider cursor-based pagination instead of offset
- More efficient for PostgreSQL
- Prevents offset-based DoS attacks
- Example: `?cursor=abc123&limit=50`

### 4. Security Headers
- Ensure backend returns appropriate security headers
- Add Content-Security-Policy to prevent XSS
- Rate limit via middleware

## Testing Checklist

- [ ] Unit tests for validation utility
- [ ] Integration tests for each API endpoint
- [ ] Negative tests with malicious inputs
- [ ] Performance tests with large offsets
- [ ] Browser dev tools testing (manual manipulation)
- [ ] API client testing (Postman, curl)

## References

- OWASP Top 10: Injection (A03:2021)
- CWE-89: SQL Injection
- CWE-400: Uncontrolled Resource Consumption
- PostgreSQL OFFSET Performance: https://use-the-index-luke.com/no-offset
- Backend API Docs: https://api.claritybusinesssolutions.ca/docs

## Conclusion

**Status:** ⚠️ CRITICAL vulnerabilities identified
**Risk:** HIGH - Exploitable via simple API manipulation
**Mitigation:** Implement centralized validation utility immediately
**Timeline:** Phase 1 fixes should be deployed within 24 hours

The lack of pagination parameter validation represents a **significant security gap** that could lead to:
- Resource exhaustion attacks
- SQL injection (if backend validation is bypassed)
- Poor user experience
- Unnecessary database load

**Recommendation:** Treat this as a **P0 security fix** and implement the centralized validation utility across all API files immediately.
