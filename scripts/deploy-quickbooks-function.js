/**
 * Deploy QuickBooks Edge Function to Supabase
 * 
 * This script helps deploy the QuickBooks API edge function to Supabase.
 * It requires the Supabase CLI to be installed.
 * 
 * Usage:
 * node scripts/deploy-quickbooks-function.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

// Check if Supabase CLI is installed
async function checkSupabaseCLI() {
  try {
    await execAsync('supabase --version');
    console.log('✅ Supabase CLI is installed');
    return true;
  } catch (error) {
    console.error('❌ Supabase CLI is not installed. Please install it first:');
    console.error('npm install -g supabase');
    return false;
  }
}

// Deploy the edge function
async function deployEdgeFunction() {
  try {
    console.log('🚀 Deploying QuickBooks API edge function...');
    await execAsync('supabase functions deploy quickbooks-api');
    console.log('✅ Edge function deployed successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to deploy edge function:', error.message);
    return false;
  }
}

// Set environment variables for the edge function
async function setEnvironmentVariables() {
  try {
    console.log('🔑 Setting environment variables...');
    
    // Check if required environment variables are set
    const requiredVars = [
      'SUPABASE_URL', 
      'SUPABASE_ANON_KEY', 
      'QB_CLIENT_ID', 
      'QB_CLIENT_SECRET'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
      console.error('Please set them in your .env file');
      return false;
    }
    
    // Set environment variables in Supabase
    for (const varName of requiredVars) {
      await execAsync(`supabase secrets set ${varName}=${process.env[varName]}`);
      console.log(`✅ Set ${varName}`);
    }
    
    console.log('✅ All environment variables set successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to set environment variables:', error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('🔧 QuickBooks API Edge Function Deployment');
  console.log('----------------------------------------');
  
  // Check if Supabase CLI is installed
  if (!await checkSupabaseCLI()) {
    process.exit(1);
  }
  
  // Deploy the edge function
  if (!await deployEdgeFunction()) {
    process.exit(1);
  }
  
  // Set environment variables
  if (!await setEnvironmentVariables()) {
    process.exit(1);
  }
  
  console.log('');
  console.log('🎉 Deployment completed successfully!');
  console.log('');
  console.log('Your QuickBooks API edge function is now available at:');
  console.log(`${process.env.SUPABASE_URL}/functions/v1/quickbooks-api`);
  console.log('');
  console.log('You can test it with:');
  console.log('curl -X GET "${SUPABASE_URL}/functions/v1/quickbooks-api/company" \\');
  console.log('  -H "Authorization: Bearer ${SUPABASE_KEY}"');
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});