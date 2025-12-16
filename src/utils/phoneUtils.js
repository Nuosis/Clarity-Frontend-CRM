/**
 * Phone number utility functions
 * Handles formatting and standardization of phone numbers
 */

/**
 * Removes all non-numeric characters from a phone number
 * @param {string} phone - Phone number string
 * @returns {string} - Cleaned phone number with only digits
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Converts phone number to E.164 international format
 * Assumes US/Canada numbers (+1) if no country code provided
 * @param {string} phone - Phone number in any format
 * @returns {string} - Phone number in E.164 format (e.g., +15551234567)
 */
export function toE164(phone) {
  if (!phone) return '';

  const cleaned = cleanPhoneNumber(phone);

  // If already has country code (11+ digits starting with 1, or starts with +)
  if (phone.startsWith('+')) {
    return '+' + cleaned;
  }

  // If 11 digits and starts with 1 (e.g., 15551234567)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return '+' + cleaned;
  }

  // If 10 digits, assume US/Canada and add +1
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  }

  // If 7 digits (local number), cannot determine country code
  // Return with +1 assumption
  if (cleaned.length === 7) {
    return '+1' + cleaned;
  }

  // For other lengths, assume it already has country code
  if (cleaned.length > 0) {
    return '+' + cleaned;
  }

  return '';
}

/**
 * Formats phone number for display in US/Canada format: (xxx) xxx-xxxx
 * Works with E.164 format or plain numbers
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted phone number for display
 */
export function formatPhoneDisplay(phone) {
  if (!phone) return '';

  const cleaned = cleanPhoneNumber(phone);

  // Remove country code if present (assuming +1 for US/Canada)
  let digits = cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    digits = cleaned.substring(1);
  }

  // Format based on length
  if (digits.length === 10) {
    // (xxx) xxx-xxxx
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
  } else if (digits.length === 7) {
    // xxx-xxxx
    return `${digits.substring(0, 3)}-${digits.substring(3)}`;
  } else if (digits.length > 10) {
    // International number - just add spaces for readability
    return `+${digits.substring(0, digits.length - 10)} ${digits.substring(digits.length - 10, digits.length - 7)} ${digits.substring(digits.length - 7, digits.length - 4)} ${digits.substring(digits.length - 4)}`;
  }

  // Return as-is if we can't format it
  return phone;
}

/**
 * Validates if a phone number is valid
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid
 */
export function isValidPhone(phone) {
  if (!phone) return false;

  const cleaned = cleanPhoneNumber(phone);

  // Must have at least 7 digits (local) or up to 15 (international max)
  return cleaned.length >= 7 && cleaned.length <= 15;
}

/**
 * Formats phone input as user types (for controlled inputs)
 * @param {string} value - Current input value
 * @returns {string} - Formatted value for display
 */
export function formatPhoneInput(value) {
  const cleaned = cleanPhoneNumber(value);

  if (cleaned.length === 0) return '';

  // Format as user types: (xxx) xxx-xxxx
  if (cleaned.length <= 3) {
    return `(${cleaned}`;
  } else if (cleaned.length <= 6) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3)}`;
  } else if (cleaned.length <= 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  } else {
    // Limit to 10 digits for US/Canada
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
  }
}
