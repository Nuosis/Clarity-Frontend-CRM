/**
 * Supabase Service
 * 
 * This service provides functionality to interact with Supabase.
 * It uses environment variables to select the correct project and get the URL and access token.
 */
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseKey } from '../config';

// Get the service role key from environment variables
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Initialize the Supabase client with environment variables
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize a separate client with service role key for admin operations
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

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
    let query = supabase.from(table);
    
    // Apply options
    if (options.select) query = query.select(options.select);
    if (options.filter) {
      const { column, operator, value } = options.filter;
      query = query.filter(column, operator, value);
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
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select();
    
    if (error) throw error;
    
    return {
      success: true,
      data: result
    };
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
    const { data: result, error } = await supabase
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
    const { data, error } = await supabase
      .from(table)
      .delete()
      .match(match);
    
    if (error) throw error;
    
    return {
      success: true,
      data
    };
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