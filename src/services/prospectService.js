/**
 * Prospect data processing and business logic
 */

import { isValidEmail, isValidPhone } from '../utils/validation';

/**
 * Processes raw prospect data from Supabase API
 * @param {Array|Object} data - Raw data from Supabase (array) or FileMaker-style wrapped data
 * @returns {Array} Processed prospect records
 */
export function processProspectData(data) {
  // Handle direct Supabase array response
  if (Array.isArray(data)) {
    return data.map(item => {
      // Extract industry from customer_settings where type='industry'
      const industrySetting = item.customer_settings?.find(s => s.type === 'industry')
      
      // Get first address (no is_primary column exists)
      const primaryAddress = item.customer_address?.[0]
      
      return {
        id: item.id,
        recordId: item.id,
        FirstName: item.first_name || '',
        LastName: item.last_name || '',
        Name: item.name || '',
        Email: item.customer_email?.[0]?.email || '',
        Phone: item.customer_phone?.[0]?.phone || '',
        Industry: industrySetting?.data || '',
        AddressLine1: primaryAddress?.address_line1 || '',
        AddressLine2: primaryAddress?.address_line2 || '',
        City: primaryAddress?.city || '',
        State: primaryAddress?.state || '',
        PostalCode: primaryAddress?.postal_code || '',
        Country: primaryAddress?.country || '',
        isActive: item.is_active ?? true,
        createdAt: item.created_at || new Date().toISOString(),
        modifiedAt: item.updated_at || new Date().toISOString(),
        type: item.type
      }
    })
  }

  // Handle FileMaker-style wrapped response (legacy)
  if (!data?.response?.data && !Array.isArray(data?.data)) {
    return []
  }

  const records = data.response?.data || data.data

  return records.map(item => {
    // Extract industry from customer_settings where type='industry'
    const industrySetting = item.customer_settings?.find(s => s.type === 'industry')
    
    // Get first address (no is_primary column exists)
    const primaryAddress = item.customer_address?.[0]
    
    return {
      id: item.id || item.recordId || item.__ID,
      recordId: item.id || item.recordId || item.__ID,
      FirstName: item.fields?.FirstName || item.first_name || '',
      LastName: item.fields?.LastName || item.last_name || '',
      Name: item.fields?.Name || item.name || '',
      Email: item.fields?.Email || item.customer_email?.[0]?.email || '',
      Phone: item.fields?.Phone || item.customer_phone?.[0]?.phone || '',
      Industry: item.fields?.Industry || industrySetting?.data || '',
      AddressLine1: item.fields?.AddressLine1 || primaryAddress?.address_line1 || '',
      AddressLine2: item.fields?.AddressLine2 || primaryAddress?.address_line2 || '',
      City: item.fields?.City || primaryAddress?.city || '',
      State: item.fields?.State || primaryAddress?.state || '',
      PostalCode: item.fields?.PostalCode || primaryAddress?.postal_code || '',
      Country: item.fields?.Country || primaryAddress?.country || '',
      isActive: item.fields?.active ?? item.is_active ?? true,
      createdAt: item.created_at || item.fields?.createdAt || new Date().toISOString(),
      modifiedAt: item.updated_at || item.fields?.modifiedAt || new Date().toISOString(),
      type: item.type || null
    }
  })
}

/**
 * Filters active prospects from a list
 * @param {Array} prospects - Array of prospect records
 * @returns {Array} Active prospect records
 */
export function filterActiveProspects(prospects) {
  return prospects.filter(p => p.isActive)
}

/**
 * Sorts prospects alphabetically by name
 * @param {Array} prospects - Array of prospect records
 * @returns {Array} Sorted prospect records
 */
export function sortProspects(prospects) {
  return [...prospects].sort((a, b) => a.Name.localeCompare(b.Name))
}

/**
 * Validates prospect data before creation or update
 * @param {Object} data - Prospect data to validate
 * @returns {Object} Validated and cleaned prospect data
 */
export function validateProspectData(data) {
  const cleaned = { ...data }
  const errors = []

  // Check for first name or last name
  if (!cleaned.FirstName && !cleaned.LastName && !cleaned.first_name && !cleaned.last_name) {
    errors.push('First name or last name is required')
  }

  if (!cleaned.Email && !cleaned.email) {
    errors.push('Email is required')
  } else if (cleaned.Email && !isValidEmail(cleaned.Email)) {
    errors.push('Invalid email format')
  } else if (cleaned.email && !isValidEmail(cleaned.email)) {
    errors.push('Invalid email format')
  }

  if (cleaned.Phone && !isValidPhone(cleaned.Phone)) {
    errors.push('Invalid phone format')
  }

  if (errors.length > 0) {
    throw new Error(errors.join(', '))
  }

  return cleaned
}

/**
 * Validate prospect data before conversion
 * @param {Object} prospect - Prospect data to validate
 * @returns {Object} Validation result with isValid flag and errors/warnings arrays
 */
export function validateProspectForConversion(prospect) {
  const errors = []
  const warnings = []

  // Check if prospect exists
  if (!prospect) {
    errors.push('Prospect data is required')
    return { isValid: false, errors, warnings }
  }

  // Check if already converted
  if (prospect.type !== 'PROSPECT') {
    errors.push('This record is not a prospect or has already been converted')
  }

  // Check for required fields
  if (!prospect.Name && !prospect.FirstName && !prospect.LastName) {
    errors.push('Prospect must have a name')
  }

  // Warn about missing contact information (not blocking)
  if (!prospect.Email) {
    warnings.push('No email address found')
  }
  if (!prospect.Phone) {
    warnings.push('No phone number found')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Process conversion result and format for UI
 * @param {Object} result - Conversion result from API
 * @returns {Object} Processed conversion result
 */
export function processConversionResult(result) {
  if (!result) {
    throw new Error('Conversion result is required')
  }

  return {
    success: result.conversionSuccess || false,
    customer: processProspectData([result])[0],
    fileMakerRecordId: result.fileMakerRecordId,
    message: result.conversionSuccess 
      ? 'Prospect successfully converted to customer'
      : 'Conversion completed with warnings'
  }
}