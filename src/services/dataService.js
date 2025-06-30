/**
 * Environment-Aware Data Service
 * 
 * This service provides a unified interface for data operations that automatically
 * routes requests based on the current environment (FileMaker vs Web App).
 */

import axios from 'axios';
import FMGofer from 'fm-gofer';
import { backendConfig } from '../config';

// Environment types
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',
  WEBAPP: 'webapp'
};

// Authentication methods
export const AUTH_METHODS = {
  FILEMAKER: 'filemaker',
  SUPABASE: 'supabase'
};

/**
 * Global environment state
 * This will be set by the authentication flow
 */
let currentEnvironment = {
  type: null,
  authentication: {
    isAuthenticated: false,
    method: null,
    user: null
  }
};

/**
 * Set the current environment context
 * @param {Object} environment - Environment configuration
 * @param {string} environment.type - Environment type ('filemaker' | 'webapp')
 * @param {Object} environment.authentication - Authentication state
 */
export const setEnvironmentContext = (environment) => {
  currentEnvironment = { ...environment };
  console.log('[DataService] Environment context set:', currentEnvironment);
};

/**
 * Get the current environment context
 * @returns {Object} Current environment configuration
 */
export const getEnvironmentContext = () => {
  return currentEnvironment;
};

/**
 * Generate HMAC-SHA256 authentication header for backend API
 * @param {string} payload - Request payload
 * @returns {Promise<string>} Authorization header
 */
const generateBackendAuthHeader = async (payload = '') => {
  const secretKey = import.meta.env.VITE_SECRET_KEY;
  
  if (!secretKey) {
    console.warn('[DataService] SECRET_KEY not available. Using development mode.');
    // In development, return a simple auth header
    const timestamp = Math.floor(Date.now() / 1000);
    return `Bearer dev-token.${timestamp}`;
  }
  
  // Check if Web Crypto API is available
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('[DataService] Web Crypto API not available. Using fallback auth.');
    const timestamp = Math.floor(Date.now() / 1000);
    return `Bearer fallback-token.${timestamp}`;
  }
  
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;
  
  try {
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
  } catch (error) {
    console.warn('[DataService] Crypto operation failed, using fallback:', error);
    return `Bearer fallback-token.${timestamp}`;
  }
};

/**
 * Convert HTTP request to FileMaker script call
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Object} data - Request data
 * @returns {Promise<Object>} FileMaker response
 */
const convertToFileMakerCall = async (method, url, data = null) => {
  // Check for FileMaker bridge availability
  const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
  const hasFileMaker = typeof window !== 'undefined' && window.FileMaker && window.FileMaker.PerformScript;
  
  if (!hasFMGofer && !hasFileMaker) {
    throw new Error('FileMaker bridge not available (neither FMGofer nor FileMaker.PerformScript found)');
  }

  // Extract endpoint from URL
  const urlParts = new URL(url);
  const endpoint = urlParts.pathname.replace('/api/', '');
  
  // Prepare script parameters following existing pattern
  const scriptParams = {
    action: 'apiCall', // Generic action for API routing
    method,
    endpoint,
    data: data || {},
    query: Object.fromEntries(urlParts.searchParams)
  };

  try {
    let result;
    
    // Use FMGofer for async operations (preferred)
    if (hasFMGofer) {
      result = await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
    } else {
      // Fallback to FileMaker.PerformScript for sync operations
      result = window.FileMaker.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
    }
    
    // Parse FileMaker response
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch (parseError) {
        return { data: result };
      }
    }
    
    return result;
  } catch (error) {
    console.error('FileMaker script execution error:', error);
    throw new Error(`FileMaker API call failed: ${error.message}`);
  }
};

/**
 * Create environment-aware axios instance
 */
const createDataServiceClient = () => {
  const client = axios.create({
    baseURL: backendConfig.baseUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Request interceptor - route based on environment
  client.interceptors.request.use(
    async (config) => {
      const env = getEnvironmentContext();
      
      console.log('[DataService] Request interceptor:', {
        environment: env.type,
        method: config.method,
        url: config.url
      });

      // If FileMaker environment, convert to FileMaker call
      if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        console.log('[DataService] Routing through FileMaker');
        
        // Store original config for FileMaker conversion
        config._isFileMakerRequest = true;
        config._originalUrl = config.url;
        config._originalData = config.data;
        
        return config;
      }

      // Web app environment - add backend authentication
      if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
        console.log('[DataService] Routing through backend API');
        
        const payload = config.data ? JSON.stringify(config.data) : '';
        const authHeader = await generateBackendAuthHeader(payload);
        config.headers.Authorization = authHeader;
        
        return config;
      }

      // No environment set - throw error
      throw new Error('Environment not detected. Please authenticate first.');
    },
    (error) => {
      console.error('[DataService] Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor - handle FileMaker responses
  client.interceptors.response.use(
    async (response) => {
      // If this was a FileMaker request, we need to handle it differently
      if (response.config._isFileMakerRequest) {
        try {
          const fileMakerResponse = await convertToFileMakerCall(
            response.config.method.toUpperCase(),
            response.config._originalUrl,
            response.config._originalData
          );
          
          // Return in axios response format
          return {
            ...response,
            data: fileMakerResponse,
            status: 200,
            statusText: 'OK'
          };
        } catch (error) {
          console.error('[DataService] FileMaker call error:', error);
          throw error;
        }
      }
      
      return response;
    },
    (error) => {
      console.error('[DataService] Response interceptor error:', error);
      
      // Handle FileMaker-specific errors
      if (error.config && error.config._isFileMakerRequest) {
        return Promise.reject(new Error(`FileMaker API Error: ${error.message}`));
      }
      
      return Promise.reject(error);
    }
  );

  return client;
};

// Create the global data service client
export const dataServiceClient = createDataServiceClient();

/**
 * Generic API methods that work in both environments
 */
export const dataService = {
  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Response data
   */
  get: async (endpoint, params = {}) => {
    const response = await dataServiceClient.get(endpoint, { params });
    return response.data;
  },

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Response data
   */
  post: async (endpoint, data = {}) => {
    const response = await dataServiceClient.post(endpoint, data);
    return response.data;
  },

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Response data
   */
  put: async (endpoint, data = {}) => {
    const response = await dataServiceClient.put(endpoint, data);
    return response.data;
  },

  /**
   * PATCH request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Response data
   */
  patch: async (endpoint, data = {}) => {
    const response = await dataServiceClient.patch(endpoint, data);
    return response.data;
  },

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>} Response data
   */
  delete: async (endpoint) => {
    const response = await dataServiceClient.delete(endpoint);
    return response.data;
  },

  /**
   * Legacy FileMaker-style request method
   * Handles both FileMaker-style parameters and HTTP requests
   * @param {Object} params - Request parameters (FileMaker-style or HTTP-style)
   * @returns {Promise<Object>} Response data
   */
  request: async (params) => {
    console.log('[DataService] Legacy request received:', params);
    
    const env = getEnvironmentContext();
    
    if (!env.type) {
      throw new Error('Environment context not set. Please authenticate first.');
    }
    
    // Check if this is FileMaker-style parameters (has layout/action)
    const isFileMakerParams = params.layout && params.action;
    
    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
      if (isFileMakerParams) {
        // Use existing FileMaker bridge directly
        const { fetchDataFromFileMaker } = await import('../api/fileMaker');
        return await fetchDataFromFileMaker(params);
      } else {
        // Convert HTTP request to FileMaker script call
        const { method = 'GET', url, data } = params;
        return await convertToFileMakerCall(method, url, data);
      }
    } else {
      // Webapp environment
      if (isFileMakerParams) {
        // Convert FileMaker params to HTTP request
        const httpConfig = convertFileMakerParamsToHTTP(params);
        return await dataService.get(httpConfig.endpoint, httpConfig.params);
      } else {
        // Handle as HTTP request
        const { method = 'GET', endpoint, data, params: queryParams } = params;
        
        switch (method.toUpperCase()) {
          case 'GET':
            return await dataService.get(endpoint, queryParams);
          case 'POST':
            return await dataService.post(endpoint, data);
          case 'PUT':
            return await dataService.put(endpoint, data);
          case 'PATCH':
            return await dataService.patch(endpoint, data);
          case 'DELETE':
            return await dataService.delete(endpoint);
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }
      }
    }
  }
};

/**
 * Convert FileMaker-style parameters to backend API call
 * @param {Object} params - FileMaker-style parameters
 * @returns {Object} HTTP request configuration
 */
const convertFileMakerParamsToHTTP = (params) => {
  const { layout, action, query, recordId, data } = params;
  
  // Map FileMaker layouts to backend endpoints
  const layoutToEndpoint = {
    'devCustomers': 'contacts_api',
    'devTeams': 'teams',
    'devProjects': 'projects',
    'devTasks': 'tasks',
    'devStaff': 'staff',
    'devTeamMembers': 'team-members',
    'devNotes': 'notes',
    'devLinks': 'links',
    'devFinancialRecords': 'financial-records'
  };
  
  const endpoint = layoutToEndpoint[layout] || layout;
  
  // Map FileMaker actions to HTTP methods and parameters
  switch (action) {
    case 'read':
      if (recordId) {
        return {
          endpoint: `${endpoint}/${recordId}`,
          params: {}
        };
      } else if (query && query.length > 0) {
        // Convert query to URL parameters
        const queryParams = {};
        query.forEach(q => {
          Object.entries(q).forEach(([key, value]) => {
            if (value !== '*') {
              queryParams[key] = value;
            }
          });
        });
        return {
          endpoint,
          params: queryParams
        };
      } else {
        return {
          endpoint,
          params: {}
        };
      }
    
    case 'create':
      return {
        method: 'POST',
        endpoint,
        data
      };
    
    case 'update':
      return {
        method: 'PUT',
        endpoint: `${endpoint}/${recordId}`,
        data
      };
    
    case 'delete':
      return {
        method: 'DELETE',
        endpoint: `${endpoint}/${recordId}`
      };
    
    default:
      throw new Error(`Unsupported FileMaker action: ${action}`);
  }
};

/**
 * Environment-specific API methods
 */
export const environmentAPI = {
  /**
   * FileMaker-specific methods
   */
  fileMaker: {
    /**
     * Execute a FileMaker script directly
     * @param {string} scriptName - Script name
     * @param {string} scriptParam - Script parameter
     * @returns {Promise<Object>} Script result
     */
    executeScript: async (scriptName, scriptParam = '') => {
      // Check for FileMaker bridge availability
      const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
      const hasFileMaker = typeof window !== 'undefined' && window.FileMaker && window.FileMaker.PerformScript;
      
      if (!hasFMGofer && !hasFileMaker) {
        throw new Error('FileMaker bridge not available');
      }
      
      // Use FMGofer for async operations (preferred)
      if (hasFMGofer) {
        return await FMGofer.PerformScript(scriptName, scriptParam);
      } else {
        // Fallback to FileMaker.PerformScript for sync operations
        return window.FileMaker.PerformScript(scriptName, scriptParam);
      }
    },

    /**
     * Get FileMaker user context
     * @returns {Promise<Object>} User context
     */
    getUserContext: async () => {
      const contextParam = JSON.stringify({ action: 'returnContext' });
      return await environmentAPI.fileMaker.executeScript('JS * Fetch Data', contextParam);
    }
  },

  /**
   * Web app specific methods
   */
  webapp: {
    /**
     * Test backend connectivity
     * @returns {Promise<Object>} Health check result
     */
    healthCheck: async () => {
      return await dataService.get('/health');
    },

    /**
     * Get backend API documentation
     * @returns {Promise<Object>} API docs
     */
    getApiDocs: async () => {
      return await dataService.get('/docs');
    }
  }
};

export default dataService;