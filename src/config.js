/**
 * Application Configuration
 */

// Supabase configuration
export const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://koxofrstjtsywvgflhyu.supabase.co';
export const supabaseKey = import.meta.env?.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtveG9mcnN0anRzeXd2Z2ZsaHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3Mjk2OTUsImV4cCI6MjA2MDMwNTY5NX0.lu8ZWDwDZNlS2EnTHfMdrWcPVhtnUIj7E6UxYUq5ZeY';

// FileMaker Data API configuration
export const fileMakerConfig = {
  // These values are set in the edge function environment
  // and don't need to be exposed in the frontend
  apiUrl: `${supabaseUrl}/functions/v1/filemaker-api`
};

export default {
  supabaseUrl,
  supabaseKey,
  fileMakerConfig
};