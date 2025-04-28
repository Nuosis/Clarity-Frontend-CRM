/**
 * Test FileMaker Edge Function
 * 
 * This script tests the FileMaker Data API edge function by making requests to it.
 * It requires the Supabase URL and key to be set in the .env file.
 * 
 * Usage:
 * node scripts/test-edge-function.js
 */

import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { createInterface } from 'readline';

// Load environment variables
dotenv.config();

// Get Supabase URL and key from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_KEY must be set in .env file');
  process.exit(1);
}

// Create readline interface for user input
const readline = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Edge function URL
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/filemaker-api`;

// Helper function to make requests to the edge function
async function makeRequest(path, method = 'GET', body = null) {
  const url = `${EDGE_FUNCTION_URL}${path}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    console.log(`Making ${method} request to ${url}`);
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      status: response.status,
      data
    };
  } catch (error) {
    console.error('Error making request:', error);
    return {
      status: 500,
      data: { error: error.message }
    };
  }
}

// Test functions
async function testListRecords(layout) {
  console.log(`\n🔍 Testing List Records for layout: ${layout}`);
  const result = await makeRequest(`/records/${layout}`);
  
  console.log(`Status: ${result.status}`);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  return result;
}

async function testGetRecord(layout, recordId) {
  console.log(`\n🔍 Testing Get Record for layout: ${layout}, recordId: ${recordId}`);
  const result = await makeRequest(`/records/${layout}/${recordId}`);
  
  console.log(`Status: ${result.status}`);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  return result;
}

async function testCreateRecord(layout, fieldData) {
  console.log(`\n🔍 Testing Create Record for layout: ${layout}`);
  const result = await makeRequest(`/records/${layout}`, 'POST', { fieldData });
  
  console.log(`Status: ${result.status}`);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  return result;
}

async function testUpdateRecord(layout, recordId, fieldData) {
  console.log(`\n🔍 Testing Update Record for layout: ${layout}, recordId: ${recordId}`);
  const result = await makeRequest(`/records/${layout}/${recordId}`, 'PATCH', { fieldData });
  
  console.log(`Status: ${result.status}`);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  return result;
}

async function testDeleteRecord(layout, recordId) {
  console.log(`\n🔍 Testing Delete Record for layout: ${layout}, recordId: ${recordId}`);
  const result = await makeRequest(`/records/${layout}/${recordId}`, 'DELETE');
  
  console.log(`Status: ${result.status}`);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  return result;
}

async function testExecuteScript(layout, scriptName, scriptParam) {
  console.log(`\n🔍 Testing Execute Script: ${scriptName} on layout: ${layout}`);
  const path = `/scripts/${layout}/${scriptName}${scriptParam ? `?script.param=${encodeURIComponent(scriptParam)}` : ''}`;
  const result = await makeRequest(path);
  
  console.log(`Status: ${result.status}`);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  return result;
}

// Main menu
function showMainMenu() {
  console.log('\n🔧 FileMaker Edge Function Test Menu');
  console.log('----------------------------------');
  console.log('1. Test List Records');
  console.log('2. Test Get Record');
  console.log('3. Test Create Record');
  console.log('4. Test Update Record');
  console.log('5. Test Delete Record');
  console.log('6. Test Execute Script');
  console.log('0. Exit');
  console.log('----------------------------------');
  
  readline.question('Select an option: ', async (option) => {
    switch (option) {
      case '1':
        await promptListRecords();
        break;
      case '2':
        await promptGetRecord();
        break;
      case '3':
        await promptCreateRecord();
        break;
      case '4':
        await promptUpdateRecord();
        break;
      case '5':
        await promptDeleteRecord();
        break;
      case '6':
        await promptExecuteScript();
        break;
      case '0':
        console.log('Exiting...');
        readline.close();
        return;
      default:
        console.log('Invalid option');
        showMainMenu();
        break;
    }
  });
}

// Prompt functions
async function promptListRecords() {
  readline.question('Enter layout name: ', async (layout) => {
    await testListRecords(layout);
    showMainMenu();
  });
}

async function promptGetRecord() {
  readline.question('Enter layout name: ', (layout) => {
    readline.question('Enter record ID: ', async (recordId) => {
      await testGetRecord(layout, recordId);
      showMainMenu();
    });
  });
}

async function promptCreateRecord() {
  readline.question('Enter layout name: ', (layout) => {
    readline.question('Enter field data as JSON (e.g., {"name":"Test","email":"test@example.com"}): ', async (fieldDataStr) => {
      try {
        const fieldData = JSON.parse(fieldDataStr);
        await testCreateRecord(layout, fieldData);
      } catch (error) {
        console.error('Invalid JSON:', error.message);
      }
      showMainMenu();
    });
  });
}

async function promptUpdateRecord() {
  readline.question('Enter layout name: ', (layout) => {
    readline.question('Enter record ID: ', (recordId) => {
      readline.question('Enter field data as JSON (e.g., {"name":"Updated Test"}): ', async (fieldDataStr) => {
        try {
          const fieldData = JSON.parse(fieldDataStr);
          await testUpdateRecord(layout, recordId, fieldData);
        } catch (error) {
          console.error('Invalid JSON:', error.message);
        }
        showMainMenu();
      });
    });
  });
}

async function promptDeleteRecord() {
  readline.question('Enter layout name: ', (layout) => {
    readline.question('Enter record ID: ', async (recordId) => {
      await testDeleteRecord(layout, recordId);
      showMainMenu();
    });
  });
}

async function promptExecuteScript() {
  readline.question('Enter layout name: ', (layout) => {
    readline.question('Enter script name: ', (scriptName) => {
      readline.question('Enter script parameter (optional): ', async (scriptParam) => {
        await testExecuteScript(layout, scriptName, scriptParam);
        showMainMenu();
      });
    });
  });
}

// Start the test
console.log('🚀 FileMaker Edge Function Test');
console.log(`Edge Function URL: ${EDGE_FUNCTION_URL}`);

showMainMenu();