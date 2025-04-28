/**
 * FileMaker Edge Function API Client
 * 
 * This module provides a client for interacting with the FileMaker Data API
 * through the Supabase Edge Function.
 */

import { supabaseUrl } from '../config';

// Base URL for the edge function
const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/filemaker-api`;

/**
 * Get the Supabase JWT token from your authentication system
 * This is needed to authenticate requests to the edge function
 */
const getAuthToken = () => {
  // Replace this with your actual token retrieval logic
  return localStorage.getItem('supabase.auth.token');
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
  
  const response = await fetch(`${EDGE_FUNCTION_URL}/records/${layout}${queryString}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
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
  const response = await fetch(`${EDGE_FUNCTION_URL}/records/${layout}/${recordId}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
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
  const response = await fetch(`${EDGE_FUNCTION_URL}/records/${layout}?_find=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify(query)
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
  const response = await fetch(`${EDGE_FUNCTION_URL}/records/${layout}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      fieldData
    })
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
  const response = await fetch(`${EDGE_FUNCTION_URL}/records/${layout}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      fieldData
    })
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
  const response = await fetch(`${EDGE_FUNCTION_URL}/records/${layout}/${recordId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
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
  
  const response = await fetch(`${EDGE_FUNCTION_URL}/scripts/${layout}/${scriptName}${queryString}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
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
  const response = await fetch(`${EDGE_FUNCTION_URL}/containers/${layout}/${recordId}/${fieldName}/${repetition}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
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
  
  const response = await fetch(`${EDGE_FUNCTION_URL}/containers/${layout}/${recordId}/${fieldName}/${repetition}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
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