/**
 * Test script for Supabase service
 *
 * This script demonstrates how to use the Supabase service
 * with environment variables to select the correct project.
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file if present
dotenv.config();

// Mock the config values that would normally come from src/config.js
// These would typically be loaded from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://koxofrstjtsywvgflhyu.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtveG9mcnN0anRzeXd2Z2ZsaHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3Mjk2OTUsImV4cCI6MjA2MDMwNTY5NX0.lu8ZWDwDZNlS2EnTHfMdrWcPVhtnUIj7E6UxYUq5ZeY';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtveG9mcnN0anRzeXd2Z2ZsaHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDcyOTY5NSwiZXhwIjoyMDYwMzA1Njk1fQ.0uAB9OadzjMzCWe3uMq1vqWLUBF1J1_n_-n9A96W8zk';

// Initialize the Supabase client directly
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize a separate client with service role key for admin operations
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Implement the same functions as in the service for testing
const getSupabaseClient = () => supabase;
const getSupabaseUrl = () => supabaseUrl;
const getSupabaseKey = () => supabaseKey;
const isSupabaseConfigured = () => !!(supabaseUrl && supabaseKey);
const getProjectId = () => {
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

async function testSupabaseService() {
  console.log('Testing Supabase Service...');
  
  // Check if Supabase is configured
  const isConfigured = isSupabaseConfigured();
  console.log(`Supabase configured: ${isConfigured}`);
  
  if (!isConfigured) {
    console.error('Supabase is not properly configured. Check your environment variables.');
    return;
  }
  
  // Get Supabase URL and key
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  console.log(`Supabase URL: ${url}`);
  console.log(`Supabase Key: ${key.substring(0, 5)}...${key.substring(key.length - 5)}`); // Show only part of the key for security
  
  // Get project ID
  const projectId = getProjectId();
  console.log(`Project ID: ${projectId}`);
  
  // Get Supabase client
  const supabase = getSupabaseClient();
  console.log('Supabase client initialized');
  
  try {
    // Test a simple query to verify connection
    console.log('Testing connection with a simple query...');
    const { data, error } = await supabase.from('functions').select('*').limit(1);
    
    if (error) {
      console.error('Error connecting to Supabase:', error.message);
    } else {
      console.log('Successfully connected to Supabase!');
      console.log('Schema data sample:', data);
    }

    // Test the user ID lookup functionality
    await testUserIdLookup();
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
  }
}

/**
 * Test the user ID lookup functionality
 */
async function testUserIdLookup() {
  console.log('\nTesting User ID Lookup...');
  
  try {
    // Test email to look up
    const testEmail = 'marcus@claritybusinesssolutions.ca'; // Use a test email that exists in your system
    console.log(`Looking up user ID for email: ${testEmail}`);
    
    // Query the customer_email table to find the customer with matching email
    // Use the admin client to bypass RLS
    const { data: emailData, error: emailError } = await supabaseAdmin
      .from('customer_email')
      .select('customer_id')
      .eq('email', testEmail)
      .limit(1);
    
    if (emailError) {
      console.error('Error querying customer_email:', emailError.message);
      return;
    }
    
    if (!emailData || emailData.length === 0) {
      console.log(`No customer found with email: ${testEmail}`);
      return;
    }
    
    // Parse the customer_id if it's a stringified JSON
    let customerId;
    try {
      const customerIdData = emailData[0].customer_id;
      customerId = typeof customerIdData === 'string' && customerIdData.startsWith('{')
        ? JSON.parse(customerIdData)
        : customerIdData;
    } catch (e) {
      // If parsing fails, use the original value
      customerId = emailData[0].customer_id;
    }
    console.log(`Found customer ID: ${customerId}`);
    
    // Query the customer_user table to get the user_id for this customer
    // Use the admin client to bypass RLS
    const { data: userData, error: userError } = await supabaseAdmin
      .from('customer_user')
      .select('user_id')
      .eq('customer_id', customerId)
      .limit(1);
    
    if (userError) {
      console.error('Error querying customer_user:', userError.message);
      return;
    }
    
    if (!userData || userData.length === 0) {
      console.log(`No user mapping found for customer ID: ${customerId}`);
      return;
    }
    
    // Parse the user_id if it's a stringified JSON
    let supabaseUserId;
    try {
      const userIdData = userData[0].user_id;
      supabaseUserId = typeof userIdData === 'string' && userIdData.startsWith('{')
        ? JSON.parse(userIdData)
        : userIdData;
    } catch (e) {
      // If parsing fails, use the original value
      supabaseUserId = userData[0].user_id;
    }
    console.log(`Found Supabase user ID: ${supabaseUserId}`);
    
    // Query the customer_organization table to get the organization_id for this customer
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('customer_organization')
      .select('organization_id')
      .eq('customer_id', customerId)
      .limit(1);
    
    if (orgError) {
      console.error('Error querying customer_organization:', orgError.message);
    } else if (!orgData || orgData.length === 0) {
      console.log(`No organization mapping found for customer ID: ${customerId}`);
    } else {
      // Parse the organization_id if it's a stringified JSON
      let supabaseOrgId;
      try {
        const orgIdData = orgData[0].organization_id;
        supabaseOrgId = typeof orgIdData === 'string' && orgIdData.startsWith('{')
          ? JSON.parse(orgIdData)
          : orgIdData;
      } catch (e) {
        // If parsing fails, use the original value
        supabaseOrgId = orgData[0].organization_id;
      }
      console.log(`Found Supabase organization ID: ${supabaseOrgId}`);
    }
    
    // Verify the user exists in the auth.users table (if you have access)
    try {
      // Use the admin client for auth operations
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(supabaseUserId);
      
      if (authError) {
        console.log('Note: Could not verify user in auth.users table:', authError.message);
      } else if (authData) {
        console.log('User verified in auth.users table:', authData.user.email);
      }
    } catch (e) {
      console.log('Note: Verification in auth.users requires admin privileges:', e.message);
    }
    
  } catch (error) {
    console.error('Error in testUserIdLookup:', error);
  }
}

// Run the test
testSupabaseService()
  .then(() => console.log('Test completed'))
  .catch(error => console.error('Test failed:', error));