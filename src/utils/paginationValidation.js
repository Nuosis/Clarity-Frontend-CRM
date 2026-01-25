/**
 * Pagination Validation Utilities
 *
 * Provides secure validation and sanitization of pagination parameters
 * to prevent SQL injection, DoS attacks, and resource exhaustion.
 *
 * @module utils/paginationValidation
 */

/**
 * Safe pagination parameter defaults
 * @constant
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
 *
 * Converts any input to a safe integer within acceptable range.
 * Protects against SQL injection, DoS, and invalid type attacks.
 *
 * @param {any} limit - Raw limit value (may be string, number, object, etc.)
 * @param {Object} [options={}] - Validation options
 * @param {number} [options.min=1] - Minimum allowed value
 * @param {number} [options.max=200] - Maximum allowed value
 * @param {number} [options.default=50] - Default value if invalid
 * @returns {number} Validated and sanitized limit (guaranteed safe integer)
 *
 * @example
 * validateLimit(50) // => 50
 * validateLimit("100") // => 100
 * validateLimit(-10) // => 1 (clamped to min)
 * validateLimit(300) // => 200 (clamped to max)
 * validateLimit("'; DROP TABLE--") // => 50 (sanitized to default)
 * validateLimit(Infinity) // => 50 (sanitized to default)
 */
export function validateLimit(limit, options = {}) {
  const {
    min = PAGINATION_DEFAULTS.MIN_LIMIT,
    max = PAGINATION_DEFAULTS.MAX_LIMIT,
    default: defaultValue = PAGINATION_DEFAULTS.DEFAULT_LIMIT
  } = options;

  // Type coercion and validation
  const parsed = parseInt(limit, 10);

  // Check if parsing succeeded (rejects NaN, Infinity, non-numeric strings)
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }

  // Clamp to safe range
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Validates and sanitizes offset parameter
 *
 * Converts any input to a safe integer within acceptable range.
 * Protects against SQL injection, DoS, and resource exhaustion.
 *
 * @param {any} offset - Raw offset value (may be string, number, object, etc.)
 * @param {Object} [options={}] - Validation options
 * @param {number} [options.min=0] - Minimum allowed value
 * @param {number} [options.max=1000000] - Maximum allowed value to prevent DoS
 * @param {number} [options.default=0] - Default value if invalid
 * @returns {number} Validated and sanitized offset (guaranteed safe integer)
 *
 * @example
 * validateOffset(100) // => 100
 * validateOffset("200") // => 200
 * validateOffset(-1) // => 0 (clamped to min)
 * validateOffset(999999999) // => 1000000 (clamped to max, prevents DoS)
 * validateOffset("abc") // => 0 (sanitized to default)
 * validateOffset(null) // => 0 (sanitized to default)
 */
export function validateOffset(offset, options = {}) {
  const {
    min = PAGINATION_DEFAULTS.MIN_OFFSET,
    max = PAGINATION_DEFAULTS.MAX_OFFSET,
    default: defaultValue = PAGINATION_DEFAULTS.DEFAULT_OFFSET
  } = options;

  // Type coercion and validation
  const parsed = parseInt(offset, 10);

  // Check if parsing succeeded (rejects NaN, Infinity, non-numeric strings)
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }

  // Clamp to safe range
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Validates pagination options object
 *
 * Validates both limit and offset parameters in a single call.
 * Returns a sanitized options object with guaranteed safe values.
 *
 * @param {Object} [options={}] - Pagination options
 * @param {any} [options.limit] - Limit parameter
 * @param {any} [options.offset] - Offset parameter
 * @param {Object} [config={}] - Validation configuration
 * @param {Object} [config.limit] - Limit validation options (passed to validateLimit)
 * @param {Object} [config.offset] - Offset validation options (passed to validateOffset)
 * @returns {Object} Sanitized pagination options { limit, offset }
 *
 * @example
 * validatePaginationParams({ limit: 50, offset: 100 })
 * // => { limit: 50, offset: 100 }
 *
 * validatePaginationParams({ limit: "'; DROP TABLE--", offset: -999 })
 * // => { limit: 50, offset: 0 }
 *
 * validatePaginationParams({ limit: 300 }, { limit: { max: 100 } })
 * // => { limit: 100, offset: 0 }
 */
export function validatePaginationParams(options = {}, config = {}) {
  // Handle null or non-object options gracefully
  const opts = options || {};

  return {
    limit: validateLimit(opts.limit, config.limit),
    offset: validateOffset(opts.offset, config.offset)
  };
}

/**
 * Validates pagination with security logging
 *
 * Same as validatePaginationParams, but logs when values are sanitized.
 * Useful for security monitoring and detecting attack attempts.
 *
 * @param {Object} [options={}] - Pagination options
 * @param {any} [options.limit] - Limit parameter
 * @param {any} [options.offset] - Offset parameter
 * @param {Object} [config={}] - Validation configuration
 * @param {string} [context='unknown'] - Context for logging (e.g., 'fetchCustomers')
 * @returns {Object} Sanitized pagination options { limit, offset }
 *
 * @example
 * validatePaginationWithLogging({ limit: 50, offset: 100 }, {}, 'fetchCustomers')
 * // => { limit: 50, offset: 100 } (no log, values unchanged)
 *
 * validatePaginationWithLogging({ limit: 999999 }, {}, 'fetchCustomers')
 * // => { limit: 200, offset: 0 } (logs warning about sanitization)
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

/**
 * Checks if pagination parameters are valid without modifying them
 *
 * Returns validation result without sanitizing values.
 * Useful for validation before displaying error messages.
 *
 * @param {Object} [options={}] - Pagination options
 * @param {any} [options.limit] - Limit parameter
 * @param {any} [options.offset] - Offset parameter
 * @param {Object} [config={}] - Validation configuration
 * @returns {Object} Validation result { isValid, errors }
 *
 * @example
 * isPaginationValid({ limit: 50, offset: 100 })
 * // => { isValid: true, errors: [] }
 *
 * isPaginationValid({ limit: -10, offset: 'abc' })
 * // => { isValid: false, errors: ['Invalid limit', 'Invalid offset'] }
 */
export function isPaginationValid(options = {}, config = {}) {
  const errors = [];

  const limitConfig = config.limit || {};
  const offsetConfig = config.offset || {};

  const min = limitConfig.min || PAGINATION_DEFAULTS.MIN_LIMIT;
  const max = limitConfig.max || PAGINATION_DEFAULTS.MAX_LIMIT;
  const offsetMin = offsetConfig.min || PAGINATION_DEFAULTS.MIN_OFFSET;
  const offsetMax = offsetConfig.max || PAGINATION_DEFAULTS.MAX_OFFSET;

  // Validate limit
  if (options.limit !== undefined) {
    const parsed = parseInt(options.limit, 10);
    if (isNaN(parsed) || !isFinite(parsed)) {
      errors.push(`Invalid limit: must be a number between ${min} and ${max}`);
    } else if (parsed < min || parsed > max) {
      errors.push(`Limit must be between ${min} and ${max}`);
    }
  }

  // Validate offset
  if (options.offset !== undefined) {
    const parsed = parseInt(options.offset, 10);
    if (isNaN(parsed) || !isFinite(parsed)) {
      errors.push(`Invalid offset: must be a number between ${offsetMin} and ${offsetMax}`);
    } else if (parsed < offsetMin || parsed > offsetMax) {
      errors.push(`Offset must be between ${offsetMin} and ${offsetMax}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
