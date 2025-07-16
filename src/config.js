/**
 * Application Configuration
 */

// Supabase configuration
export const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://supabase.claritybusinesssolutions.ca';
export const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
export const supabaseServiceRoleKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY;

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