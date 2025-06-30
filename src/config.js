/**
 * Application Configuration
 */

// Supabase configuration
export const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://supabase.claritybusinesssolutions.ca';
export const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUxMDg5MTE4LCJleHAiOjIwNjUzMjc0NDZ9.CG_oQSoIRHeXtQDaR4u2mQxZKpIlVZ_7TZZ6JVWEV6w';
export const supabaseServiceRoleKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

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