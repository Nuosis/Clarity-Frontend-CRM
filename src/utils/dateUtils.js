/**
 * Date utility functions for consistent date handling across the application
 * Handles conversions between FileMaker format (MM/DD/YYYY) and Supabase format (YYYY-MM-DD)
 */

import { parse, format, isValid, parseISO } from 'date-fns';

/**
 * Parse a date string in various formats and return a Date object
 * Supports ISO format (YYYY-MM-DD), FileMaker format (MM/DD/YYYY), and ISO timestamps
 * @param {string|Date} dateString - Date string in various formats or Date object
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export const parseDate = (dateString) => {
  if (!dateString) {
    return null;
  }

  // If already a Date object, validate and return
  if (dateString instanceof Date) {
    return isValid(dateString) ? dateString : null;
  }

  if (typeof dateString !== 'string') {
    return null;
  }

  // Try different date formats using date-fns
  let date = null;

  // ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss (Supabase format)
  if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    date = parseISO(dateString);
  }
  // FileMaker/US format: MM/DD/YYYY
  else if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    date = parse(dateString, 'MM/dd/yyyy', new Date());
  }
  // Try parsing as-is for other formats
  else {
    date = new Date(dateString);
  }

  // Check if the date is valid
  if (date && isValid(date)) {
    return date;
  }

  return null;
};

/**
 * Format a date to ISO format (YYYY-MM-DD) - Supabase standard
 * @param {Date|string} date - Date object or date string
 * @returns {string} - Formatted date string in ISO format (YYYY-MM-DD)
 */
export const formatDate = (date) => {
  let dateObj = date;

  if (typeof date === 'string') {
    dateObj = parseDate(date);
  }

  if (!dateObj || !isValid(dateObj)) {
    return '';
  }

  return format(dateObj, 'yyyy-MM-dd');
};

/**
 * Convert FileMaker date format (MM/DD/YYYY) to Supabase format (YYYY-MM-DD)
 * @param {string} fileMakerDate - Date string in MM/DD/YYYY format
 * @returns {string|null} - Date string in YYYY-MM-DD format or null if invalid
 */
export const convertFileMakerToSupabase = (fileMakerDate) => {
  if (!fileMakerDate || typeof fileMakerDate !== 'string') {
    return null;
  }

  // Validate format: MM/DD/YYYY
  if (!fileMakerDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    console.warn(`[dateUtils] Invalid FileMaker date format: ${fileMakerDate}. Expected MM/DD/YYYY`);
    return null;
  }

  try {
    const dateObj = parse(fileMakerDate, 'MM/dd/yyyy', new Date());

    if (!isValid(dateObj)) {
      console.warn(`[dateUtils] Invalid date: ${fileMakerDate}`);
      return null;
    }

    return format(dateObj, 'yyyy-MM-dd');
  } catch (error) {
    console.error(`[dateUtils] Error converting FileMaker date: ${fileMakerDate}`, error);
    return null;
  }
};

/**
 * Convert Supabase date format (YYYY-MM-DD) to FileMaker format (MM/DD/YYYY)
 * @param {string} supabaseDate - Date string in YYYY-MM-DD format
 * @returns {string|null} - Date string in MM/DD/YYYY format or null if invalid
 */
export const convertSupabaseToFileMaker = (supabaseDate) => {
  if (!supabaseDate || typeof supabaseDate !== 'string') {
    return null;
  }

  // Validate format: YYYY-MM-DD
  if (!supabaseDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    console.warn(`[dateUtils] Invalid Supabase date format: ${supabaseDate}. Expected YYYY-MM-DD`);
    return null;
  }

  try {
    const dateObj = parseISO(supabaseDate);

    if (!isValid(dateObj)) {
      console.warn(`[dateUtils] Invalid date: ${supabaseDate}`);
      return null;
    }

    return format(dateObj, 'MM/dd/yyyy');
  } catch (error) {
    console.error(`[dateUtils] Error converting Supabase date: ${supabaseDate}`, error);
    return null;
  }
};

/**
 * Format a date to FileMaker/US display format (MM/DD/YYYY)
 * Note: Despite the function name, this now returns US format to match FileMaker expectations
 * @param {Date|string} date - Date object or date string
 * @returns {string} - Formatted date string in MM/DD/YYYY format
 */
export const formatDateCanadian = (date) => {
  let dateObj = date;

  if (typeof date === 'string') {
    dateObj = parseDate(date);
  }

  if (!dateObj || !isValid(dateObj)) {
    return '';
  }

  return format(dateObj, 'MM/dd/yyyy');
};

/**
 * Format a date to FileMaker/US display format (MM/DD/YYYY)
 * Alias for clarity - same as formatDateCanadian but with correct name
 * @param {Date|string} date - Date object or date string
 * @returns {string} - Formatted date string in MM/DD/YYYY format
 */
export const formatDateUS = (date) => {
  return formatDateCanadian(date);
};

/**
 * Format a date to YYYY-MM format for grouping
 * @param {Date|string} date - Date object or date string
 * @returns {string} - Formatted date string in YYYY-MM format
 */
export const formatYearMonth = (date) => {
  let dateObj = date;

  if (typeof date === 'string') {
    dateObj = parseDate(date);
  }

  if (!dateObj || !isValid(dateObj)) {
    return '';
  }

  return format(dateObj, 'yyyy-MM');
};

/**
 * Get month name and year for display
 * @param {Date|string} date - Date object or date string
 * @returns {string} - Formatted month and year (e.g., "January 2025")
 */
export const formatMonthYear = (date) => {
  let dateObj = date;

  if (typeof date === 'string') {
    dateObj = parseDate(date);
  }

  if (!dateObj || !isValid(dateObj)) {
    return '';
  }

  return format(dateObj, 'MMMM yyyy');
};

/**
 * Check if a date string is valid
 * @param {string|Date} dateString - Date string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidDate = (dateString) => {
  const date = parseDate(dateString);
  return date !== null;
};

/**
 * Validate if a string matches FileMaker date format (MM/DD/YYYY)
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - True if matches MM/DD/YYYY format and is a valid date
 */
export const isValidFileMakerDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  // Check format
  if (!dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    return false;
  }

  // Check if it's a valid date
  try {
    const dateObj = parse(dateString, 'MM/dd/yyyy', new Date());
    return isValid(dateObj);
  } catch {
    return false;
  }
};

/**
 * Validate if a string matches Supabase date format (YYYY-MM-DD)
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - True if matches YYYY-MM-DD format and is a valid date
 */
export const isValidSupabaseDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  // Check format
  if (!dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return false;
  }

  // Check if it's a valid date
  try {
    const dateObj = parseISO(dateString);
    return isValid(dateObj);
  } catch {
    return false;
  }
};