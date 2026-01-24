/**
 * Shared validation utilities
 */

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidPhone(phone) {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone);
}

/**
 * Validate UUID format (v4)
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID format, false otherwise
 */
export function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hexadecimal digit and y is one of 8, 9, A, or B
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate UUID and throw error if invalid
 * @param {string} uuid - UUID string to validate
 * @param {string} fieldName - Name of the field for error message
 * @throws {Error} If UUID is invalid
 */
export function validateUUID(uuid, fieldName = 'ID') {
  if (!isValidUUID(uuid)) {
    throw new Error(`Invalid ${fieldName} format. Expected a valid UUID.`);
  }
}