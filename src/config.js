/**
 * Application Configuration
 */

// Supabase configuration
export const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://supabase.claritybusinesssolutions.ca';
export const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUyNjM3OTA0LCJleHAiOjMzMjk0Mzc5MDR9.Bwn_0KJfRevNalsGPLOI_kkbwj060DpcNSSOw2TOOO4';
export const supabaseServiceRoleKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTI2Mzc5MDQsImV4cCI6MzMyOTQzNzkwNH0.q74pL-kOG-XzotiRdm51QC9vZn1VsgiX5y4POPLnGPM';

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