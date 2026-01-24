/**
 * Input Sanitization and Validation Utilities
 *
 * Provides centralized input sanitization, length validation, and XSS prevention
 * for all user-generated text content across the application.
 */

/**
 * Database field length constraints from backend schema
 */
export const FIELD_LIMITS = {
  // Customers
  CUSTOMER_BUSINESS_NAME: 255,
  CUSTOMER_PRIMARY_CONTACT: 255,
  CUSTOMER_EMAIL: 320, // RFC 5321 max email length
  CUSTOMER_PHONE: 50,
  CUSTOMER_ADDRESS_LINE: 500,
  CUSTOMER_CITY: 100,
  CUSTOMER_STATE: 100,
  CUSTOMER_POSTAL_CODE: 20,
  CUSTOMER_COUNTRY: 100,

  // Projects
  PROJECT_NAME: 255,
  PROJECT_DESCRIPTION: 10000, // text field, reasonable limit
  PROJECT_STATUS: 20,
  PROJECT_URL: 2048, // Max URL length
  PROJECT_TIME_ESTIMATE: 500,

  // Tasks
  TASK_TITLE: 500,
  TASK_TYPE: 100,
  TASK_NOTES: 10000, // text field, reasonable limit
  TASK_STATUS: 50,

  // Notes
  NOTE_CONTENT: 50000, // text field, generous limit for detailed notes
  NOTE_TYPE: 100,

  // Proposals
  PROPOSAL_TITLE: 255,
  PROPOSAL_DESCRIPTION: 50000, // text field for detailed proposals
  PROPOSAL_STATUS: 20,

  // Teams
  TEAM_NAME: 255,
  TEAM_DESCRIPTION: 2000,
  STAFF_NAME: 255,
  STAFF_EMAIL: 320,
  STAFF_PHONE: 50,
  STAFF_ROLE: 100,

  // Products
  PRODUCT_NAME: 255,
  PRODUCT_DESCRIPTION: 10000,
  PRODUCT_SKU: 100,

  // General
  GENERIC_SHORT_TEXT: 255,
  GENERIC_MEDIUM_TEXT: 1000,
  GENERIC_LONG_TEXT: 10000,
  GENERIC_VERY_LONG_TEXT: 50000
};

/**
 * Sanitizes text input by removing potentially dangerous characters and scripts
 * @param {string} input - Raw user input
 * @param {Object} options - Sanitization options
 * @param {boolean} options.allowHTML - Whether to allow HTML tags (default: false)
 * @param {boolean} options.trim - Whether to trim whitespace (default: true)
 * @param {boolean} options.normalizeWhitespace - Whether to normalize whitespace (default: true)
 * @returns {string} Sanitized text
 */
export function sanitizeText(input, options = {}) {
  const {
    allowHTML = false,
    trim = true,
    normalizeWhitespace = true
  } = options;

  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  if (!allowHTML) {
    // Escape HTML special characters to prevent XSS
    sanitized = escapeHTML(sanitized);
  }

  if (normalizeWhitespace) {
    // Normalize multiple spaces to single space (preserve newlines)
    sanitized = sanitized.replace(/[^\S\n]+/g, ' ');
    // Remove excessive newlines (more than 2 consecutive)
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  }

  if (trim) {
    sanitized = sanitized.trim();
  }

  return sanitized;
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
export function escapeHTML(text) {
  if (typeof text !== 'string') {
    return '';
  }

  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'/]/g, char => htmlEscapeMap[char]);
}

/**
 * Unescapes HTML entities back to original characters
 * @param {string} text - HTML-escaped text
 * @returns {string} Unescaped text
 */
export function unescapeHTML(text) {
  if (typeof text !== 'string') {
    return '';
  }

  const htmlUnescapeMap = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/'
  };

  return text.replace(/&(?:amp|lt|gt|quot|#x27|#x2F);/g, entity => htmlUnescapeMap[entity] || entity);
}

/**
 * Validates text length against a maximum limit
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum allowed length
 * @param {string} fieldName - Field name for error message
 * @returns {Object} Validation result { isValid, error }
 */
export function validateLength(text, maxLength, fieldName = 'Field') {
  if (typeof text !== 'string') {
    return { isValid: true, error: null };
  }

  if (text.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} must be ${maxLength} characters or less (currently ${text.length} characters)`
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validates text length is within a range
 * @param {string} text - Text to validate
 * @param {number} minLength - Minimum allowed length
 * @param {number} maxLength - Maximum allowed length
 * @param {string} fieldName - Field name for error message
 * @returns {Object} Validation result { isValid, error }
 */
export function validateLengthRange(text, minLength, maxLength, fieldName = 'Field') {
  if (typeof text !== 'string') {
    return { isValid: true, error: null };
  }

  const trimmed = text.trim();

  if (trimmed.length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${minLength} characters (currently ${trimmed.length} characters)`
    };
  }

  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} must be ${maxLength} characters or less (currently ${trimmed.length} characters)`
    };
  }

  return { isValid: true, error: null };
}

/**
 * Sanitizes and validates text input with length limits
 * @param {string} input - Raw user input
 * @param {Object} options - Validation options
 * @param {number} options.maxLength - Maximum allowed length
 * @param {number} options.minLength - Minimum allowed length (default: 0)
 * @param {string} options.fieldName - Field name for error messages
 * @param {boolean} options.required - Whether field is required (default: false)
 * @param {boolean} options.allowHTML - Whether to allow HTML (default: false)
 * @returns {Object} Result { value, isValid, error }
 */
export function sanitizeAndValidate(input, options = {}) {
  const {
    maxLength,
    minLength = 0,
    fieldName = 'Field',
    required = false,
    allowHTML = false
  } = options;

  // Sanitize first
  const sanitized = sanitizeText(input, { allowHTML, trim: true, normalizeWhitespace: true });

  // Check required
  if (required && !sanitized.trim()) {
    return {
      value: sanitized,
      isValid: false,
      error: `${fieldName} is required`
    };
  }

  // Skip further validation for empty optional fields
  if (!required && !sanitized.trim()) {
    return {
      value: sanitized,
      isValid: true,
      error: null
    };
  }

  // Validate length range
  if (maxLength !== undefined) {
    const lengthValidation = validateLengthRange(sanitized, minLength, maxLength, fieldName);
    if (!lengthValidation.isValid) {
      return {
        value: sanitized,
        isValid: false,
        error: lengthValidation.error
      };
    }
  }

  return {
    value: sanitized,
    isValid: true,
    error: null
  };
}

/**
 * Truncates text to a maximum length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} ellipsis - Ellipsis string (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength, ellipsis = '...') {
  if (typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Validates email format
 * @param {string} email - Email address to validate
 * @returns {Object} Validation result { isValid, error }
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();

  // Check length (RFC 5321)
  if (trimmed.length > FIELD_LIMITS.CUSTOMER_EMAIL) {
    return {
      isValid: false,
      error: `Email must be ${FIELD_LIMITS.CUSTOMER_EMAIL} characters or less`
    };
  }

  // Email regex - RFC 5322 simplified
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true, error: null };
}

/**
 * Validates phone format (international formats)
 * @param {string} phone - Phone number to validate
 * @returns {Object} Validation result { isValid, error }
 */
export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const trimmed = phone.trim();

  // Check length
  if (trimmed.length > FIELD_LIMITS.CUSTOMER_PHONE) {
    return {
      isValid: false,
      error: `Phone number must be ${FIELD_LIMITS.CUSTOMER_PHONE} characters or less`
    };
  }

  // Phone regex - allows international formats
  const phoneRegex = /^\+?[\d\s\-()\.]+$/;
  if (!phoneRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid phone format (allowed: digits, spaces, +, -, (), .)'
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @returns {Object} Validation result { isValid, error }
 */
export function validateURL(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  const trimmed = url.trim();

  // Check length
  if (trimmed.length > FIELD_LIMITS.PROJECT_URL) {
    return {
      isValid: false,
      error: `URL must be ${FIELD_LIMITS.PROJECT_URL} characters or less`
    };
  }

  // URL regex - basic validation
  try {
    new URL(trimmed);
    return { isValid: true, error: null };
  } catch (e) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Checks if text contains potential XSS attack patterns
 * @param {string} text - Text to check
 * @returns {boolean} True if suspicious patterns found
 */
export function containsXSSPatterns(text) {
  if (typeof text !== 'string') {
    return false;
  }

  const xssPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /eval\(/gi,
    /expression\(/gi
  ];

  return xssPatterns.some(pattern => pattern.test(text));
}

/**
 * Removes potential XSS patterns from text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
export function removeXSSPatterns(text) {
  if (typeof text !== 'string') {
    return '';
  }

  let cleaned = text;

  // Remove script tags and content
  cleaned = cleaned.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');

  // Remove event handlers
  cleaned = cleaned.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  cleaned = cleaned.replace(/javascript:/gi, '');

  // Remove dangerous tags
  cleaned = cleaned.replace(/<(iframe|object|embed|applet|meta|link|style)[^>]*>/gi, '');

  return cleaned;
}

/**
 * Sanitizes and validates customer business name
 * @param {string} name - Business name
 * @param {boolean} required - Whether field is required
 * @returns {Object} Result { value, isValid, error }
 */
export function sanitizeBusinessName(name, required = true) {
  return sanitizeAndValidate(name, {
    maxLength: FIELD_LIMITS.CUSTOMER_BUSINESS_NAME,
    minLength: required ? 1 : 0,
    fieldName: 'Business name',
    required,
    allowHTML: false
  });
}

/**
 * Sanitizes and validates project name
 * @param {string} name - Project name
 * @param {boolean} required - Whether field is required
 * @returns {Object} Result { value, isValid, error }
 */
export function sanitizeProjectName(name, required = true) {
  return sanitizeAndValidate(name, {
    maxLength: FIELD_LIMITS.PROJECT_NAME,
    minLength: required ? 1 : 0,
    fieldName: 'Project name',
    required,
    allowHTML: false
  });
}

/**
 * Sanitizes and validates task title
 * @param {string} title - Task title
 * @param {boolean} required - Whether field is required
 * @returns {Object} Result { value, isValid, error }
 */
export function sanitizeTaskTitle(title, required = true) {
  return sanitizeAndValidate(title, {
    maxLength: FIELD_LIMITS.TASK_TITLE,
    minLength: required ? 1 : 0,
    fieldName: 'Task title',
    required,
    allowHTML: false
  });
}

/**
 * Sanitizes and validates note content
 * @param {string} content - Note content
 * @param {boolean} required - Whether field is required
 * @returns {Object} Result { value, isValid, error }
 */
export function sanitizeNoteContent(content, required = true) {
  return sanitizeAndValidate(content, {
    maxLength: FIELD_LIMITS.NOTE_CONTENT,
    minLength: required ? 1 : 0,
    fieldName: 'Note content',
    required,
    allowHTML: false
  });
}

/**
 * Batch sanitizes object fields
 * @param {Object} data - Data object to sanitize
 * @param {Object} fieldConfig - Configuration for each field
 * @returns {Object} Result { sanitizedData, errors }
 *
 * @example
 * const result = batchSanitize({
 *   name: 'Test Co.',
 *   email: 'test@example.com'
 * }, {
 *   name: { maxLength: 255, required: true, fieldName: 'Company name' },
 *   email: { validate: validateEmail }
 * });
 */
export function batchSanitize(data, fieldConfig) {
  const sanitizedData = {};
  const errors = {};

  Object.keys(fieldConfig).forEach(fieldName => {
    const config = fieldConfig[fieldName];
    const value = data[fieldName];

    if (config.validate && typeof config.validate === 'function') {
      // Use custom validator
      const validation = config.validate(value);
      if (!validation.isValid) {
        errors[fieldName] = validation.error;
      }
      sanitizedData[fieldName] = value;
    } else {
      // Use standard sanitization
      const result = sanitizeAndValidate(value, {
        maxLength: config.maxLength,
        minLength: config.minLength || 0,
        fieldName: config.fieldName || fieldName,
        required: config.required || false,
        allowHTML: config.allowHTML || false
      });

      sanitizedData[fieldName] = result.value;
      if (!result.isValid) {
        errors[fieldName] = result.error;
      }
    }
  });

  return {
    sanitizedData,
    errors,
    isValid: Object.keys(errors).length === 0
  };
}
