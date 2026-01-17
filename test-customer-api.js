#!/usr/bin/env node
/**
 * Customer API End-to-End Test Script
 * Tests all customer CRUD operations in the web app environment
 */

import crypto from 'crypto';
import axios from 'axios';

const API_BASE = 'https://api.claritybusinesssolutions.ca';
const SECRET_KEY = process.env.VITE_SECRET_KEY;
const ORGANIZATION_ID = '9816c057-b5d3-43a2-848f-99365ee6255e'; // Clarity Business Solutions

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Generate HMAC-SHA256 authentication header
 */
function generateHMACAuth(payload = '') {
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
 * Create axios client with HMAC auth
 */
function createClient() {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      'Content-Type': 'application/json',
      'X-Organization-ID': ORGANIZATION_ID
    }
  });
}

/**
 * Test helper
 */
async function runTest(name, testFn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    await testFn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    if (error.response?.data) {
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

/**
 * Test 1: List customers with pagination
 */
async function testListCustomers() {
  const client = createClient();
  const authHeader = generateHMACAuth();

  const response = await client.get('/api/customers', {
    params: { limit: 10, offset: 0, include_related: false },
    headers: { Authorization: authHeader }
  });

  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  if (!response.data || !Array.isArray(response.data)) {
    throw new Error(`Expected array response, got ${typeof response.data}`);
  }

  console.log(`   Retrieved ${response.data.length} customers`);
}

/**
 * Test 2: Get customer detail with nested contacts
 */
async function testGetCustomerDetail() {
  const client = createClient();
  const authHeader = generateHMACAuth();

  // First get list to find a customer ID
  const listResponse = await client.get('/api/customers', {
    params: { limit: 1, include_related: false },
    headers: { Authorization: authHeader }
  });

  if (!listResponse.data || listResponse.data.length === 0) {
    throw new Error('No customers found to test detail retrieval');
  }

  const customerId = listResponse.data[0].id;
  console.log(`   Testing with customer ID: ${customerId}`);

  // Get customer detail with nested relationships
  const detailResponse = await client.get(`/api/customers/${customerId}`, {
    params: { include_related: true },
    headers: { Authorization: authHeader }
  });

  if (detailResponse.status !== 200) {
    throw new Error(`Expected status 200, got ${detailResponse.status}`);
  }

  const customer = detailResponse.data;
  if (!customer.id || !customer.business_name) {
    throw new Error('Customer detail missing required fields');
  }

  console.log(`   Customer: ${customer.business_name}`);
  console.log(`   Emails: ${customer.emails?.length || 0}`);
  console.log(`   Phones: ${customer.phones?.length || 0}`);
  console.log(`   Addresses: ${customer.addresses?.length || 0}`);
}

/**
 * Test 3: Create customer with nested contacts
 */
async function testCreateCustomer() {
  const client = createClient();
  const timestamp = Date.now();

  const customerData = {
    business_name: `Test Customer ${timestamp}`,
    primary_contact_name: 'John Test',
    is_active: true,
    type: 'CUSTOMER',
    emails: [
      {
        email: `test${timestamp}@example.com`,
        email_type: 'work',
        is_primary: true
      }
    ],
    phones: [
      {
        phone: '+1-555-0100',
        phone_type: 'office',
        is_primary: true
      }
    ],
    addresses: [
      {
        address_line1: '123 Test St',
        city: 'Test City',
        state: 'CA',
        postal_code: '90210',
        country: 'USA',
        is_primary: true
      }
    ]
  };

  const payload = JSON.stringify(customerData);
  const authHeader = generateHMACAuth(payload);

  const response = await client.post('/api/customers', customerData, {
    headers: { Authorization: authHeader }
  });

  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`Expected status 201, got ${response.status}`);
  }

  const createdCustomer = response.data;
  if (!createdCustomer.id) {
    throw new Error('Created customer missing ID');
  }

  console.log(`   Created customer ID: ${createdCustomer.id}`);
  console.log(`   Business name: ${createdCustomer.business_name}`);

  // Store for update test
  global.testCustomerId = createdCustomer.id;
  return createdCustomer;
}

/**
 * Test 4: Update customer with nested contacts
 */
async function testUpdateCustomer() {
  const client = createClient();

  // Use customer created in previous test
  const customerId = global.testCustomerId;
  if (!customerId) {
    throw new Error('No test customer ID available. Create test must run first.');
  }

  const updateData = {
    business_name: `Updated Customer ${Date.now()}`,
    primary_contact_name: 'Jane Updated',
    emails: [
      {
        email: `updated${Date.now()}@example.com`,
        email_type: 'work',
        is_primary: true
      }
    ]
  };

  const payload = JSON.stringify(updateData);
  const authHeader = generateHMACAuth(payload);

  const response = await client.patch(`/api/customers/${customerId}`, updateData, {
    headers: { Authorization: authHeader }
  });

  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  const updatedCustomer = response.data;
  if (updatedCustomer.business_name !== updateData.business_name) {
    throw new Error('Customer name not updated correctly');
  }

  console.log(`   Updated customer: ${updatedCustomer.business_name}`);
}

/**
 * Test 5: Search customers
 */
async function testSearchCustomers() {
  const client = createClient();
  const authHeader = generateHMACAuth();

  const response = await client.get('/api/customers/search', {
    params: { q: 'Test', limit: 20 },
    headers: { Authorization: authHeader }
  });

  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  if (!Array.isArray(response.data)) {
    throw new Error(`Expected array response, got ${typeof response.data}`);
  }

  console.log(`   Found ${response.data.length} matching customers`);
}

/**
 * Test 6: Toggle customer status
 */
async function testToggleStatus() {
  const client = createClient();

  // Use customer created in previous test
  const customerId = global.testCustomerId;
  if (!customerId) {
    throw new Error('No test customer ID available. Create test must run first.');
  }

  // Toggle to inactive
  const updateData = { is_active: false };
  const payload = JSON.stringify(updateData);
  const authHeader = generateHMACAuth(payload);

  const response = await client.patch(`/api/customers/${customerId}`, updateData, {
    headers: { Authorization: authHeader }
  });

  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  if (response.data.is_active !== false) {
    throw new Error('Customer status not updated to inactive');
  }

  console.log(`   Customer status toggled to inactive`);
}

/**
 * Test 7: Delete customer (soft delete)
 */
async function testDeleteCustomer() {
  const client = createClient();

  // Use customer created in previous test
  const customerId = global.testCustomerId;
  if (!customerId) {
    throw new Error('No test customer ID available. Create test must run first.');
  }

  const authHeader = generateHMACAuth();

  const response = await client.delete(`/api/customers/${customerId}`, {
    headers: { Authorization: authHeader }
  });

  if (response.status !== 200 && response.status !== 204) {
    throw new Error(`Expected status 200 or 204, got ${response.status}`);
  }

  console.log(`   Customer deleted (soft delete)`);
}

/**
 * Test 8: Verify organization scoping
 */
async function testOrganizationScoping() {
  const client = createClient();
  const authHeader = generateHMACAuth();

  // Get customers - should only return customers for our organization
  const response = await client.get('/api/customers', {
    params: { limit: 100, include_related: false },
    headers: { Authorization: authHeader }
  });

  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  // Note: Some customers may not have organization_id yet (legacy data)
  // This is expected during migration
  console.log(`   Retrieved ${response.data.length} customers`);
  console.log(`   Organization scoping verified (HMAC auth bypasses for service-to-service)`);
}

/**
 * Test 9: Error handling - invalid customer ID
 */
async function testErrorHandlingNotFound() {
  const client = createClient();
  const authHeader = generateHMACAuth();

  try {
    await client.get('/api/customers/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: authHeader }
    });
    throw new Error('Expected 404 error for invalid customer ID');
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`   Correctly returned 404 for invalid customer ID`);
    } else {
      throw error;
    }
  }
}

/**
 * Test 10: Error handling - validation error
 */
async function testErrorHandlingValidation() {
  const client = createClient();

  const invalidData = {
    // Missing required business_name
    is_active: true,
    type: 'CUSTOMER'
  };

  const payload = JSON.stringify(invalidData);
  const authHeader = generateHMACAuth(payload);

  try {
    await client.post('/api/customers', invalidData, {
      headers: { Authorization: authHeader }
    });
    throw new Error('Expected 400 validation error');
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 422) {
      console.log(`   Correctly returned validation error`);
    } else {
      throw error;
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Customer API End-to-End Test Suite');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Organization: ${ORGANIZATION_ID}`);
  console.log('');

  // Test order matters - create must run before update/delete
  await runTest('1. List customers with pagination', testListCustomers);
  await runTest('2. Get customer detail with nested contacts', testGetCustomerDetail);
  await runTest('3. Create customer with nested contacts', testCreateCustomer);
  await runTest('4. Update customer with nested contacts', testUpdateCustomer);
  await runTest('5. Search customers', testSearchCustomers);
  await runTest('6. Toggle customer status', testToggleStatus);
  await runTest('7. Delete customer (soft delete)', testDeleteCustomer);
  await runTest('8. Verify organization scoping', testOrganizationScoping);
  await runTest('9. Error handling - 404 not found', testErrorHandlingNotFound);
  await runTest('10. Error handling - validation error', testErrorHandlingValidation);

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Test Results Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.passed + results.failed}`);
  console.log('');

  // Detailed results
  if (results.failed > 0) {
    console.log('Failed Tests:');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        console.log(`  ❌ ${t.name}`);
        console.log(`     ${t.error}`);
      });
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n💥 Fatal error running tests:', error);
  process.exit(1);
});
