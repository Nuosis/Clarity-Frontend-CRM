/**
 * Supabase Service
 *
 * This service provides functionality to interact with Supabase through the backend API.
 * It routes calls through api.claritybusinesssolutions.ca instead of direct Supabase connections.
 */
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, backendConfig } from '../config';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

if (!supabaseServiceRoleKey) {
  console.warn('Missing Supabase service role key - admin functions will not work');
}

// Regular client for user operations (authentication)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for admin operations (bypassing RLS)
const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

/**
 * Generate HMAC-SHA256 authentication header for backend API
 * @param {string} payload - Request payload
 * @returns {Promise<string>} Authorization header
 */
async function generateBackendAuthHeader(payload = '') {
    const secretKey = import.meta.env.VITE_SECRET_KEY;
    
    if (!secretKey) {
        console.warn('[Supabase] SECRET_KEY not available. Using development mode.');
        const timestamp = Math.floor(Date.now() / 1000);
        return `Bearer dev-token.${timestamp}`;
    }
    
    // Check if Web Crypto API is available
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        console.warn('[Supabase] Web Crypto API not available. Using fallback auth.');
        const timestamp = Math.floor(Date.now() / 1000);
        return `Bearer fallback-token.${timestamp}`;
    }
    
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}.${payload}`;
    
    try {
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
        console.warn('[Supabase] Crypto operation failed, using fallback:', error);
        const timestamp = Math.floor(Date.now() / 1000);
        return `Bearer fallback-token.${timestamp}`;
    }
}

/**
 * Call backend API for Supabase operations
 * @param {string} table - Table name
 * @param {string} operation - Operation type (select, insert, update, delete)
 * @param {Object} options - Operation options
 * @returns {Promise<Object>} Backend API response
 */
async function callBackendSupabaseAPI(table, operation, options = {}) {
    console.log('[Supabase] Calling backend API:', { table, operation });
    
    try {
        let url, method, requestData, queryParams;
        
        // Map operations to HTTP requests
        switch (operation) {
            case 'select':
                url = `/supabase/${table}/select`;
                method = 'GET';
                queryParams = {};
                
                if (options.columns) {
                    queryParams.columns = options.columns;
                }
                
                if (options.filters || options.eq || options.filter) {
                    // Convert filters to JSON string
                    const filters = {};
                    
                    if (options.eq) {
                        filters[options.eq.column] = options.eq.value;
                    }
                    
                    if (options.filter) {
                        filters[options.filter.column] = options.filter.value;
                    }
                    
                    if (options.filters && Array.isArray(options.filters)) {
                        for (const filter of options.filters) {
                            if (filter.type === 'eq') {
                                filters[filter.column] = filter.value;
                            }
                            // Add more filter types as needed
                        }
                    }
                    
                    if (Object.keys(filters).length > 0) {
                        queryParams.filters = JSON.stringify(filters);
                    }
                }
                break;
                
            case 'insert':
                url = `/supabase/${table}/insert`;
                method = 'POST';
                requestData = {
                    table,
                    data: options.data
                };
                break;
                
            case 'update':
                url = `/supabase/${table}/update`;
                method = 'PATCH';
                requestData = {
                    table,
                    data: options.data,
                    filters: options.match || options.filters || {}
                };
                break;
                
            case 'delete':
                url = `/supabase/${table}/delete`;
                method = 'DELETE';
                requestData = options.match || options.filters || {};
                break;
                
            default:
                throw new Error(`Unsupported Supabase operation: ${operation}`);
        }
        
        // Prepare request config
        const config = {
            method,
            url: `${backendConfig.baseUrl}${url}`,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        // Add query parameters for GET requests
        if (queryParams && Object.keys(queryParams).length > 0) {
            config.params = queryParams;
        }
        
        // Add request data for non-GET requests
        if (requestData) {
            config.data = requestData;
            
            // Generate auth header with payload
            const payload = JSON.stringify(requestData);
            config.headers.Authorization = await generateBackendAuthHeader(payload);
        } else {
            // Generate auth header without payload for GET requests
            config.headers.Authorization = await generateBackendAuthHeader();
        }
        
        console.log('[Supabase] Making request:', {
            method: config.method,
            url: config.url,
            hasAuth: !!config.headers.Authorization
        });
        
        const response = await axios(config);
        
        console.log('[Supabase] Backend API response:', {
            status: response.status,
            dataLength: Array.isArray(response.data) ? response.data.length : 'not-array'
        });
        
        return {
            success: true,
            data: response.data
        };
        
    } catch (error) {
        console.error('[Supabase] Backend API error:', error);
        
        const errorMessage = error.response?.data?.detail ||
                           error.response?.data?.message ||
                           error.message ||
                           'Unknown backend API error';
        
        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Get the current Supabase client instance
 * @returns {Object} - The Supabase client instance
 */
export const getSupabaseClient = () => {
  return supabase;
};

/**
 * Get the current Supabase URL
 * @returns {string} - The Supabase URL
 */
export const getSupabaseUrl = () => {
  return supabaseUrl;
};

/**
 * Get the current Supabase key
 * @returns {string} - The Supabase key
 */
export const getSupabaseKey = () => {
  return supabaseKey;
};

/**
 * Initialize a new Supabase client with custom URL and key
 * @param {string} url - Custom Supabase URL
 * @param {string} key - Custom Supabase key
 * @returns {Object} - A new Supabase client instance
 */
export const createSupabaseClient = (url, key) => {
  return createClient(url, key);
};

/**
 * Get the Supabase admin client (with service role key)
 * This client bypasses RLS and should only be used for specific admin operations
 * @returns {Object|null} - The Supabase admin client or null if not configured
 */
export const getSupabaseAdminClient = () => {
  if (!supabaseAdmin) {
    console.warn('Supabase admin client not initialized. Service role key may be missing.');
  }
  return supabaseAdmin;
};

/**
 * Check if Supabase is properly configured
 * @returns {boolean} - True if Supabase is configured, false otherwise
 */
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseKey);
};

/**
 * Get the current Supabase project ID from the URL
 * @returns {string|null} - The project ID or null if not found
 */
export const getProjectId = () => {
  if (!supabaseUrl) return null;
  
  try {
    // Extract project ID from URL (format: https://[project-id].supabase.co)
    const url = new URL(supabaseUrl);
    const hostname = url.hostname;
    const projectId = hostname.split('.')[0];
    return projectId;
  } catch (error) {
    console.error('Error extracting project ID from Supabase URL:', error);
    return null;
  }
};

/**
 * Authenticate with Supabase using email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - Authentication response
 */
export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error signing in with email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Sign out the current user
 * @returns {Promise<Object>} - Sign out response
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) throw error;
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error signing out:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get the current user session
 * @returns {Promise<Object>} - Session response
 */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Execute a database query
 * @param {string} table - Table name
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Query response
 */
export const query = async (table, options = {}) => {
  try {
    return await callBackendSupabaseAPI(table, 'select', {
      columns: options.select || '*',
      eq: options.eq,
      filter: options.filter,
      filters: options.filters,
      order: options.order,
      limit: options.limit
    });
  } catch (error) {
    console.error(`Error querying table ${table}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Insert data into a table
 * @param {string} table - Table name
 * @param {Object|Array} data - Data to insert
 * @returns {Promise<Object>} - Insert response
 */
export const insert = async (table, data) => {
  try {
    // Ensure data has an id field - add UUID if missing
    let processedData = data;
    
    if (Array.isArray(data)) {
      // Handle array of records
      processedData = data.map(record => {
        if (!record.id) {
          return { id: uuidv4(), ...record };
        }
        return record;
      });
    } else if (typeof data === 'object' && data !== null) {
      // Handle single record
      if (!data.id) {
        processedData = { id: uuidv4(), ...data };
      }
    }
    
    return await callBackendSupabaseAPI(table, 'insert', {
      data: processedData
    });
  } catch (error) {
    console.error(`Error inserting into table ${table}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update data in a table
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {Object} match - Match condition
 * @returns {Promise<Object>} - Update response
 */
export const update = async (table, data, match) => {
  try {
    return await callBackendSupabaseAPI(table, 'update', {
      data: data,
      match: match
    });
  } catch (error) {
    console.error(`Error updating table ${table}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete data from a table
 * @param {string} table - Table name
 * @param {Object} match - Match condition
 * @returns {Promise<Object>} - Delete response
 */
export const remove = async (table, match) => {
  try {
    return await callBackendSupabaseAPI(table, 'delete', {
      match: match
    });
  } catch (error) {
    console.error(`Error deleting from table ${table}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Execute a database query with admin privileges (bypassing RLS)
 * @param {string} table - Table name
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Query response
 */
export const adminQuery = async (table, options = {}) => {
  if (!supabaseAdmin) {
    console.error('Admin query failed: Supabase admin client not initialized');
    return {
      success: false,
      error: 'Supabase admin client not initialized'
    };
  }

  try {
    let query = supabaseAdmin.from(table);
    
    // Apply options
    if (options.select) query = query.select(options.select);
    if (options.filter) {
      const { column, operator, value } = options.filter;
      query = query.filter(column, operator, value);
    }
    
    // Apply multiple filters
    if (options.filters && Array.isArray(options.filters)) {
      for (const filter of options.filters) {
        const { type, column, value } = filter;
        switch (type) {
          case 'eq': query = query.eq(column, value); break;
          case 'neq': query = query.neq(column, value); break;
          case 'gt': query = query.gt(column, value); break;
          case 'gte': query = query.gte(column, value); break;
          case 'lt': query = query.lt(column, value); break;
          case 'lte': query = query.lte(column, value); break;
          case 'is': query = query.is(column, value); break;
          case 'in': query = query.in(column, value); break;
          default: break;
        }
      }
    }
    if (options.eq) {
      const { column, value } = options.eq;
      query = query.eq(column, value);
    }
    if (options.order) {
      const { column, ascending } = options.order;
      query = query.order(column, { ascending });
    }
    if (options.limit) query = query.limit(options.limit);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error(`Error in admin query for table ${table}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Insert data into a table with admin privileges (bypassing RLS)
 * @param {string} table - Table name
 * @param {Object|Array} data - Data to insert
 * @returns {Promise<Object>} - Insert response
 */
export const adminInsert = async (table, data) => {
  if (!supabaseAdmin) {
    console.error('Admin insert failed: Supabase admin client not initialized');
    return {
      success: false,
      error: 'Supabase admin client not initialized'
    };
  }

  try {
    const { data: result, error } = await supabaseAdmin
      .from(table)
      .insert(data)
      .select();
    
    if (error) throw error;
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error(`Error in admin insert for table ${table}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update data in a table with admin privileges (bypassing RLS)
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {Object} match - Match condition
 * @returns {Promise<Object>} - Update response
 */
export const adminUpdate = async (table, data, match) => {
  if (!supabaseAdmin) {
    console.error('Admin update failed: Supabase admin client not initialized');
    return {
      success: false,
      error: 'Supabase admin client not initialized'
    };
  }

  try {
    const { data: result, error } = await supabaseAdmin
      .from(table)
      .update(data)
      .match(match)
      .select();
    
    if (error) throw error;
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error(`Error in admin update for table ${table}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete data from a table with admin privileges (bypassing RLS)
 * @param {string} table - Table name
 * @param {Object} match - Match condition
 * @returns {Promise<Object>} - Delete response
 */
export const adminRemove = async (table, match) => {
  if (!supabaseAdmin) {
    console.error('Admin remove failed: Supabase admin client not initialized');
    return {
      success: false,
      error: 'Supabase admin client not initialized'
    };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .delete()
      .match(match);
    
    if (error) throw error;
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error(`Error in admin remove for table ${table}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  getSupabaseClient,
  getSupabaseUrl,
  getSupabaseKey,
  createSupabaseClient,
  getSupabaseAdminClient,
  isSupabaseConfigured,
  getProjectId,
  signInWithEmail,
  signOut,
  getSession,
  query,
  adminQuery,
  insert,
  adminInsert,
  update,
  adminUpdate,
  remove,
  adminRemove
};