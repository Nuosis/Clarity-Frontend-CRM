/**
 * Data Service
 *
 * This service provides a unified interface for data operations using
 * Supabase + Backend API architecture.
 */

import axios from 'axios';
import { backendConfig } from '../config';
import { getSession } from './supabaseService';

/**
 * Global authentication state
 * This will be set by the authentication flow
 */
let currentAuthentication = {
  isAuthenticated: false,
  user: null
};

/**
 * Set the authentication context
 * @param {Object} authState - Authentication state
 * @param {boolean} authState.isAuthenticated - Whether user is authenticated
 * @param {Object} authState.user - User object with organization ID
 */
export const setAuthenticationContext = (authState) => {
  currentAuthentication = { ...authState };
  console.log('[DataService] Authentication context set:', {
    isAuthenticated: currentAuthentication.isAuthenticated,
    hasUser: !!currentAuthentication.user,
    hasOrganizationId: !!currentAuthentication.user?.supabaseOrgID
  });
};

/**
 * Get the current authentication context
 * @returns {Object} Current authentication state
 */
export const getAuthenticationContext = () => {
  return currentAuthentication;
};

/**
 * Get organization ID from authentication context
 * @returns {string|null} Organization ID or null
 */
export const getOrganizationId = () => {
  return currentAuthentication?.user?.supabaseOrgID || null;
};

/**
 * Check if organization context is available
 * @returns {boolean} True if organization ID is available
 */
export const hasOrganizationContext = () => {
  return Boolean(currentAuthentication?.user?.supabaseOrgID);
};

const emptyPayloadTokenCache = { token: null, expiresAt: 0 };

const parseBackendAuthError = async (response) => {
  try {
    const errorText = await response.text();
    if (!errorText) return `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      return errorJson.detail || errorJson.message || errorText;
    } catch {
      return errorText;
    }
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
};

const getSupabaseAccessToken = async () => {
  const sessionResult = await getSession();
  if (!sessionResult?.success) {
    throw new Error(sessionResult?.error || 'Supabase session unavailable.');
  }
  const accessToken = sessionResult?.data?.session?.access_token;
  if (!accessToken) {
    throw new Error('Supabase access token unavailable.');
  }
  return accessToken;
};

const requestBackendAuthToken = async (payload, organizationId) => {
  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(`${backendConfig.baseUrl}/auth/generate-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      payload,
      organization_id: organizationId || null
    })
  });

  if (!response.ok) {
    throw new Error(await parseBackendAuthError(response));
  }

  const data = await response.json();
  if (!data?.token) {
    throw new Error('Backend token missing in response.');
  }

  return data;
};

/**
 * Generate authentication header for backend API
 * Uses the backend token endpoint to avoid client-side HMAC secrets.
 * @param {string} payload - Request payload
 * @returns {Promise<string>} Authorization header
 */
export const generateBackendAuthHeader = async (payload = '') => {
  if (!payload && emptyPayloadTokenCache.token && Date.now() < emptyPayloadTokenCache.expiresAt) {
    return emptyPayloadTokenCache.token;
  }

  const tokenResponse = await requestBackendAuthToken(payload, getOrganizationId());
  const token = tokenResponse.token;

  if (!payload) {
    const ttlMs = Math.max(0, (tokenResponse.expires_in || 300) - 30) * 1000;
    emptyPayloadTokenCache.token = token;
    emptyPayloadTokenCache.expiresAt = Date.now() + ttlMs;
  }

  return token;
};

/**
 * Create axios instance for backend API
 */
const createDataServiceClient = () => {
  const client = axios.create({
    baseURL: backendConfig.baseUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Request interceptor - add authentication and organization context
  client.interceptors.request.use(
    async (config) => {
      const auth = getAuthenticationContext();

      console.log('[DataService] Request interceptor:', {
        method: config.method,
        url: config.url,
        isAuthenticated: auth.isAuthenticated
      });

      // Add backend authentication
      const payload = config.data ? JSON.stringify(config.data) : '';
      const authHeader = await generateBackendAuthHeader(payload);
      if (authHeader) {
        config.headers.Authorization = authHeader;
      }

      // Add organization_id to headers for backend API calls
      if (auth.user && auth.user.supabaseOrgID) {
        config.headers['X-Organization-ID'] = auth.user.supabaseOrgID;
        console.log('[DataService] Added organization context');
      } else {
        console.warn('[DataService] Organization ID not found in user context. This may cause authorization errors.', {
          url: config.url,
          method: config.method,
          hasUser: !!auth.user,
          userKeys: auth.user ? Object.keys(auth.user) : []
        });
        // Note: We don't throw an error here to allow initialization to complete
        // Some endpoints may not require organization scoping
      }

      return config;
    },
    (error) => {
      console.error('[DataService] Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor - handle errors
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('[DataService] Response error:', error);
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
   * Generic request method for flexibility
   * @param {Object} params - Request parameters
   * @param {string} params.method - HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @param {string} params.endpoint - API endpoint
   * @param {Object} params.data - Request data (for POST/PUT/PATCH)
   * @param {Object} params.params - Query parameters (for GET)
   * @returns {Promise<Object>} Response data
   */
  request: async (params) => {
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
};

/**
 * Utility methods
 */
export const utils = {
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
};

// Backward compatibility exports (deprecated)
// These are maintained for transition period but will be removed
export const ENVIRONMENT_TYPES = {
  WEBAPP: 'webapp'
};

export const AUTH_METHODS = {
  SUPABASE: 'supabase'
};

/**
 * @deprecated Use setAuthenticationContext instead
 */
export const setEnvironmentContext = (environment) => {
  console.warn('[DataService] setEnvironmentContext is deprecated. Use setAuthenticationContext instead.');
  if (environment.authentication) {
    setAuthenticationContext(environment.authentication);
  }
};

/**
 * @deprecated Use getAuthenticationContext instead
 */
export const getEnvironmentContext = () => {
  console.warn('[DataService] getEnvironmentContext is deprecated. Use getAuthenticationContext instead.');
  return {
    type: ENVIRONMENT_TYPES.WEBAPP,
    authentication: currentAuthentication
  };
};

export default dataService;
