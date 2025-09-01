/**
 * FileMaker Edge Function API Client
 * ** DO NOT USE DEPRICATED ** use filemaker.js
 * This module provides a client for interacting with the FileMaker Data API
 * through the Backend Function.
 */

// Base URL for the backend API
const BACKEND_API_URL = 'https://api.claritybusinesssolutions.ca/filemaker';

/**
 * Generate HMAC-SHA256 authentication header for Clarity backend
 * @param {string} payload - The request payload (JSON string or empty string)
 * @returns {string} - The authorization header value
 */
const generateAuthHeader = async (payload = '') => {
  const secretKey = import.meta.env.VITE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('SECRET_KEY not available. Check environment variables.');
  }
  
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;
  
  // Use Web Crypto API for HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `Bearer ${signatureHex}.${timestamp}`;
};

/**
 * Get the authentication token for backend API requests
 * This will be replaced with environment-aware authentication
 */
const getAuthToken = (payload = '') => {
  return generateAuthHeader(payload);
};

/**
 * Record Operations
 */

/**
 * List records from a layout
 * @param {string} layout - The layout name
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - The API response
 */
export const listRecords = async (layout, options = {}) => {
  const queryParams = new URLSearchParams();
  
  // Add any query parameters
  Object.entries(options).forEach(([key, value]) => {
    queryParams.append(key, value);
  });
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  
  const authHeader = await getAuthToken();
  
  const response = await fetch(`${BACKEND_API_URL}/records/${layout}${queryString}`, {
    headers: {
      'Authorization': authHeader
    }
  });
  
  return await response.json();
};

/**
 * Get a specific record by ID
 * @param {string} layout - The layout name
 * @param {string} recordId - The record ID
 * @returns {Promise<Object>} - The API response
 */
export const getRecord = async (layout, recordId) => {
  const authHeader = await getAuthToken();
  
  const response = await fetch(`${BACKEND_API_URL}/records/${layout}/${recordId}`, {
    headers: {
      'Authorization': authHeader
    }
  });
  
  return await response.json();
};

/**
 * Find records using a query
 * @param {string} layout - The layout name
 * @param {Object} query - The find query
 * @returns {Promise<Object>} - The API response
 */
export const findRecords = async (layout, query) => {
  const payload = JSON.stringify(query);
  const authHeader = await getAuthToken(payload);
  
  const response = await fetch(`${BACKEND_API_URL}/records/${layout}?_find=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: payload
  });
  
  return await response.json();
};

/**
 * Create a new record
 * @param {string} layout - The layout name
 * @param {Object} fieldData - The field data for the new record
 * @returns {Promise<Object>} - The API response
 */
export const createRecord = async (layout, fieldData) => {
  const payload = JSON.stringify({ fieldData });
  const authHeader = await getAuthToken(payload);
  
  const response = await fetch(`${BACKEND_API_URL}/records/${layout}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: payload
  });
  
  return await response.json();
};

/**
 * Update an existing record
 * @param {string} layout - The layout name
 * @param {string} recordId - The record ID
 * @param {Object} fieldData - The updated field data
 * @returns {Promise<Object>} - The API response
 */
export const updateRecord = async (layout, recordId, fieldData) => {
  const payload = JSON.stringify({ fieldData });
  const authHeader = await getAuthToken(payload);
  
  const response = await fetch(`${BACKEND_API_URL}/records/${layout}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: payload
  });
  
  return await response.json();
};

/**
 * Delete a record
 * @param {string} layout - The layout name
 * @param {string} recordId - The record ID
 * @returns {Promise<Object>} - The API response
 */
export const deleteRecord = async (layout, recordId) => {
  const authHeader = await getAuthToken();
  
  const response = await fetch(`${BACKEND_API_URL}/records/${layout}/${recordId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': authHeader
    }
  });
  
  return await response.json();
};

/**
 * Script Operations
 */

/**
 * Execute a FileMaker script
 * @param {string} layout - The layout name
 * @param {string} scriptName - The script name
 * @param {string} scriptParam - The script parameter (optional)
 * @returns {Promise<Object>} - The API response
 */
export const executeScript = async (layout, scriptName, scriptParam = '') => {
  const queryParams = new URLSearchParams();
  
  if (scriptParam) {
    queryParams.append('script.param', scriptParam);
  }
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  
  const authHeader = await getAuthToken();
  
  const response = await fetch(`${BACKEND_API_URL}/scripts/${layout}/${scriptName}${queryString}`, {
    headers: {
      'Authorization': authHeader
    }
  });
  
  return await response.json();
};

/**
 * Container Operations
 */

/**
 * Download container data
 * @param {string} layout - The layout name
 * @param {string} recordId - The record ID
 * @param {string} fieldName - The container field name
 * @param {string} repetition - The repetition number (default: 1)
 * @returns {Promise<Blob>} - The file blob
 */
export const downloadContainer = async (layout, recordId, fieldName, repetition = '1') => {
  const authHeader = await getAuthToken();
  
  const response = await fetch(`${BACKEND_API_URL}/containers/${layout}/${recordId}/${fieldName}/${repetition}`, {
    headers: {
      'Authorization': authHeader
    }
  });
  
  return await response.blob();
};

/**
 * Upload a file to a container field
 * @param {string} layout - The layout name
 * @param {string} recordId - The record ID
 * @param {string} fieldName - The container field name
 * @param {File} file - The file to upload
 * @param {string} repetition - The repetition number (default: 1)
 * @returns {Promise<Object>} - The API response
 */
export const uploadContainer = async (layout, recordId, fieldName, file, repetition = '1') => {
  const formData = new FormData();
  formData.append('file', file);
  
  // For FormData, we need to handle authentication differently since we can't include the body in the signature
  const authHeader = await getAuthToken();
  
  const response = await fetch(`${BACKEND_API_URL}/containers/${layout}/${recordId}/${fieldName}/${repetition}`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader
    },
    body: formData
  });
  
  return await response.json();
};

export default {
  listRecords,
  getRecord,
  findRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  executeScript,
  downloadContainer,
  uploadContainer
};