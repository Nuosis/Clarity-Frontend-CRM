/**
 * Date utility functions for consistent date handling across the application
 * Optimized for Canadian/ISO date formatting preferences
 */

/**
 * Parse a date string in various formats and return a Date object
 * Assumes ISO format (YYYY-MM-DD) as the default/preferred format
 * @param {string} dateString - Date string in various formats
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export const parseDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  // Try different date formats, prioritizing ISO format
  let date = null;

  // ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss (preferred format)
  if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    date = new Date(dateString);
  }
  // Canadian format: DD/MM/YYYY (more common in Canada than US format)
  else if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const parts = dateString.split('/');
    // Assume DD/MM/YYYY format for Canadian preference
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-based
    const year = parseInt(parts[2], 10);
    date = new Date(year, month, day);
  }
  // Try parsing as-is for other formats
  else {
    date = new Date(dateString);
  }

  // Check if the date is valid
  if (date && !isNaN(date.getTime())) {
    return date;
  }

  return null;
};

/**
 * Format a date to ISO format (YYYY-MM-DD) - Canadian/International standard
 * @param {Date|string} date - Date object or date string
 * @returns {string} - Formatted date string in ISO format
 */
export const formatDate = (date) => {
  let dateObj = date;
  
  if (typeof date === 'string') {
    dateObj = parseDate(date);
  }
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    return '';
  }

  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Format a date to Canadian display format (DD/MM/YYYY)
 * @param {Date|string} date - Date object or date string
 * @returns {string} - Formatted date string in Canadian format
 */
export const formatDateCanadian = (date) => {
  let dateObj = date;
  
  if (typeof date === 'string') {
    dateObj = parseDate(date);
  }
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    return '';
  }

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}/${month}/${year}`;
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
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    return '';
  }

  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');

  return `${year}-${month}`;
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
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    return '';
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const month = monthNames[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  return `${month} ${year}`;
};

/**
 * Check if a date string is valid
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidDate = (dateString) => {
  const date = parseDate(dateString);
  return date !== null;
};