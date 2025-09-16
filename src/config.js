/**
 * Application Configuration
 */

// Environment variable logging for investigation
console.log('[ENV-INVESTIGATION] Environment variable loading check:', {
  timestamp: new Date().toISOString(),
  hasImportMeta: typeof import.meta !== 'undefined',
  hasImportMetaEnv: typeof import.meta?.env !== 'undefined',
  viteSupabaseUrl: import.meta.env?.VITE_SUPABASE_URL,
  viteSupabaseAnonKeyExists: !!import.meta.env?.VITE_SUPABASE_ANON_KEY,
  viteSupabaseAnonKeyLength: import.meta.env?.VITE_SUPABASE_ANON_KEY?.length,
  viteServiceRoleKeyExists: !!import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY,
  viteServiceRoleKeyLength: import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY?.length,
  viteSecretKeyExists: !!import.meta.env?.VITE_SECRET_KEY,
  viteSecretKeyLength: import.meta.env?.VITE_SECRET_KEY?.length
});

// Supabase configuration
export const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://supabase.claritybusinesssolutions.ca';
export const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
export const supabaseServiceRoleKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('[ENV-INVESTIGATION] Final configuration values:', {
  timestamp: new Date().toISOString(),
  supabaseUrl,
  supabaseAnonKeyExists: !!supabaseAnonKey,
  supabaseAnonKeyLength: supabaseAnonKey?.length,
  supabaseServiceRoleKeyExists: !!supabaseServiceRoleKey,
  supabaseServiceRoleKeyLength: supabaseServiceRoleKey?.length
});

// For backward compatibility
export const supabaseKey = supabaseAnonKey;

// Backend API configuration
export const backendConfig = {
  baseUrl: 'https://api.claritybusinesssolutions.ca',
  fileMakerApiUrl: 'https://api.claritybusinesssolutions.ca/filemaker',
  quickBooksApiUrl: 'https://api.claritybusinesssolutions.ca/quickbooks'
};

// FileMaker Data API configuration (updated to use backend)
export const fileMakerConfig = {
  apiUrl: backendConfig.fileMakerApiUrl
};

export default {
  supabaseUrl,
  supabaseKey,
  backendConfig,
  fileMakerConfig
};