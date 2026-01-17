#!/usr/bin/env node

/**
 * QuickBooks Backend API Endpoint Tester
 *
 * Tests all QuickBooks endpoints with proper HMAC authentication
 * Usage: node test-qb-endpoints.js
 */

import crypto from 'crypto';
import https from 'https';

// Configuration
const API_URL = 'https://api.claritybusinesssolutions.ca';
const SECRET_KEY = process.env.VITE_SECRET_KEY;
const ORG_ID = '9816c057-b5d3-43a2-848f-99365ee6255e';

/**
 * Generate HMAC-SHA256 authentication header
 * @param {string} payload - Request payload (empty string for GET)
 * @returns {string} Authorization header value
 */
function generateAuthHeader(payload = '') {
  if (!SECRET_KEY) {
    throw new Error('Missing VITE_SECRET_KEY environment variable.');
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  return `Bearer ${signature}.${timestamp}`;
}

/**
 * Make authenticated API request
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {object|null} body - Request body (null for GET)
 * @returns {Promise<object>} Response data
 */
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const authHeader = generateAuthHeader(payload);

    const url = new URL(path, API_URL);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': authHeader,
        'X-Organization-ID': ORG_ID,
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`${method} ${path}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Authorization: ${authHeader}`);
    console.log(`X-Organization-ID: ${ORG_ID}`);
    if (body) {
      console.log(`Body: ${payload}`);
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`\nStatus: ${res.statusCode}`);
        console.log(`Response Headers:`, res.headers);

        let responseData;
        try {
          responseData = JSON.parse(data);
          console.log(`\nResponse Body:`);
          console.log(JSON.stringify(responseData, null, 2));
        } catch (e) {
          console.log(`\nResponse Body (raw):`);
          console.log(data);
          responseData = data;
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    });

    req.on('error', (error) => {
      console.error(`\nRequest Error: ${error.message}`);
      reject(error);
    });

    if (body) {
      req.write(payload);
    }

    req.end();
  });
}

/**
 * Test all QuickBooks endpoints
 */
async function testEndpoints() {
  console.log('\n' + '='.repeat(80));
  console.log('QuickBooks Backend API Endpoint Tests');
  console.log('='.repeat(80));
  console.log(`API URL: ${API_URL}`);
  console.log(`Organization ID: ${ORG_ID}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const results = [];

  try {
    // Test 1: GET /quickbooks/status
    console.log('\n\n📊 TEST 1: Check QuickBooks Connection Status');
    const statusResult = await makeRequest('GET', `/quickbooks/status?organization_id=${ORG_ID}`);
    results.push({ endpoint: '/quickbooks/status', ...statusResult });

    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: GET /quickbooks/unbilled-records
    console.log('\n\n💰 TEST 2: Fetch Unbilled Records');
    const unbilledResult = await makeRequest('GET', '/quickbooks/unbilled-records?limit=10');
    results.push({ endpoint: '/quickbooks/unbilled-records', ...unbilledResult });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: POST /quickbooks/invoices/from-records
    // Only test if we have unbilled records
    if (unbilledResult.status === 200 && unbilledResult.body && unbilledResult.body.records && unbilledResult.body.records.length > 0) {
      console.log('\n\n📝 TEST 3: Create Invoice from Records');
      const recordIds = unbilledResult.body.records.slice(0, 3).map(r => r.id);
      const invoicePayload = {
        record_ids: recordIds,
        customer_qb_id: '1', // This should be a real QB customer ID
        send_email: false
      };
      const invoiceResult = await makeRequest('POST', '/quickbooks/invoices/from-records', invoicePayload);
      results.push({ endpoint: '/quickbooks/invoices/from-records', ...invoiceResult });
    } else {
      console.log('\n\n📝 TEST 3: Create Invoice from Records - SKIPPED (no unbilled records)');
      results.push({
        endpoint: '/quickbooks/invoices/from-records',
        status: 'skipped',
        reason: 'No unbilled records available'
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 4: POST /quickbooks/sync-invoices
    console.log('\n\n🔄 TEST 4: Sync Invoices from QuickBooks');
    const syncPayload = {
      start_date: '2025-01-01',
      end_date: '2025-01-15'
    };
    const syncResult = await makeRequest('POST', '/quickbooks/sync-invoices', syncPayload);
    results.push({ endpoint: '/quickbooks/sync-invoices', ...syncResult });

  } catch (error) {
    console.error('\n\n❌ Test execution failed:', error.message);
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  results.forEach((result, index) => {
    const status = result.status === 'skipped' ? '⏭️  SKIPPED' :
                   result.status >= 200 && result.status < 300 ? '✅ PASSED' :
                   result.status >= 400 && result.status < 500 ? '⚠️  CLIENT ERROR' :
                   result.status >= 500 ? '❌ SERVER ERROR' : '❓ UNKNOWN';

    console.log(`\n${index + 1}. ${result.endpoint}`);
    console.log(`   Status: ${status} ${result.status !== 'skipped' ? `(${result.status})` : ''}`);
    if (result.reason) {
      console.log(`   Reason: ${result.reason}`);
    }
    if (result.body && result.body.detail) {
      console.log(`   Detail: ${result.body.detail}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('Tests completed!');
  console.log('='.repeat(80) + '\n');
}

// Run tests
testEndpoints().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
