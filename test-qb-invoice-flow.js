/**
 * QuickBooks Invoice Generation End-to-End Test
 *
 * This script tests the complete invoice generation flow:
 * 1. Fetch unbilled records via get_unpaid_records RPC
 * 2. Create QB invoice using QuickBooks API
 * 3. Mark records as billed via mark_records_billed RPC
 * 4. Verify inv_id is set correctly
 * 5. Verify records no longer appear in unbilled list
 *
 * Prerequisites:
 * - QuickBooks sandbox credentials must be configured
 * - Test customer must exist in both Supabase and QuickBooks
 * - Test unbilled records must exist in customer_sales table
 *
 * Usage:
 *   node test-qb-invoice-flow.js
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import 'dotenv/config';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const BACKEND_API_URL = process.env.VITE_API_URL || 'https://api.claritybusinesssolutions.ca';
const SECRET_KEY = process.env.VITE_SECRET_KEY;
const ORG_ID = process.env.VITE_CLARITY_INTEGRATION_ORG_ID;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SECRET_KEY || !ORG_ID) {
  console.error('❌ Missing required environment variables');
  console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY, VITE_SECRET_KEY, VITE_CLARITY_INTEGRATION_ORG_ID');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Generate HMAC-SHA256 authentication header for Clarity backend
 * @param {string} payload - The request payload (JSON string or empty string)
 * @returns {string} - The authorization header value
 */
function generateAuthHeader(payload = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(message).digest('hex');
  return `Bearer ${signature}.${timestamp}`;
}

/**
 * Make a request to the QuickBooks API backend
 * @param {string} endpoint - The endpoint to call (without /quickbooks prefix)
 * @param {string} method - The HTTP method to use
 * @param {Object} data - The data to send (for POST/PUT requests)
 * @returns {Promise<Object>} - The API response
 */
async function makeQBRequest(endpoint, method = 'GET', data = null) {
  const payload = (method !== 'GET' && data) ? JSON.stringify(data) : '';
  const authHeader = generateAuthHeader(payload);

  const headers = {
    'Authorization': authHeader,
    'X-Organization-ID': ORG_ID,
    'Content-Type': 'application/json'
  };

  const requestOptions = {
    method,
    headers
  };

  if (method !== 'GET' && payload) {
    requestOptions.body = payload;
  }

  const url = `${BACKEND_API_URL}/quickbooks${endpoint}`;
  console.log(`🌐 Making ${method} request to: ${url}`);

  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    const errorText = await response.text();
    let errorData = null;
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      errorData = JSON.parse(errorText);
      errorMessage = errorData.detail || errorData.message || errorData.error || errorText || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    console.error(`❌ HTTP ${response.status} error from ${url}`);
    console.error('Response:', errorText);

    const error = new Error(errorMessage);
    error.status = response.status;
    error.responseData = errorData;
    error.responseText = errorText;
    throw error;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  } else {
    return await response.text();
  }
}

/**
 * Convert date from MM/DD/YYYY to YYYY-MM-DD format
 * @param {string} dateString - Date in MM/DD/YYYY format
 * @returns {string} - Date in YYYY-MM-DD format
 */
function convertFileMakerToSupabase(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const parts = dateString.split('/');
  if (parts.length !== 3) {
    return null;
  }

  const [month, day, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Test Step 1: Fetch unbilled records
 */
async function testFetchUnbilledRecords() {
  console.log('\n📋 Step 1: Fetch unbilled records via get_unpaid_records RPC');
  console.log('═'.repeat(70));

  try {
    const { data, error } = await supabase.rpc('get_unpaid_records', {
      p_organization_id: ORG_ID,
      p_customer_id: null // Get all unbilled records
    });

    if (error) {
      throw new Error(`RPC error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log('⚠️  No unbilled records found. Test cannot proceed.');
      console.log('💡 Tip: Create test records using the timer or create_financial_record RPC');
      return null;
    }

    console.log(`✅ Found ${data.length} unbilled records`);

    // Fetch customer names for all unique customer IDs
    const customerIds = [...new Set(data.map(r => r.customer_id))];
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id, business_name')
      .in('id', customerIds);

    if (customerError) {
      console.warn(`⚠️  Could not fetch customer names: ${customerError.message}`);
    }

    // Map customer names to records
    const customerMap = new Map(customers?.map(c => [c.id, c.business_name]) || []);
    const enrichedData = data.map(record => ({
      ...record,
      customer_name: customerMap.get(record.customer_id) || 'Unknown Customer'
    }));

    console.log('\nFirst record sample:');
    console.log(JSON.stringify(enrichedData[0], null, 2));

    // Group by customer
    const byCustomer = enrichedData.reduce((acc, record) => {
      const customerId = record.customer_id;
      if (!acc[customerId]) {
        acc[customerId] = {
          customerName: record.customer_name,
          records: []
        };
      }
      acc[customerId].records.push(record);
      return acc;
    }, {});

    console.log('\n📊 Unbilled records by customer:');
    Object.entries(byCustomer).forEach(([customerId, { customerName, records }]) => {
      const totalAmount = records.reduce((sum, r) => sum + (r.total_price || 0), 0);
      console.log(`  • ${customerName} (${customerId}): ${records.length} records, $${totalAmount.toFixed(2)}`);
    });

    return enrichedData;
  } catch (error) {
    console.error('❌ Error fetching unbilled records:', error.message);
    throw error;
  }
}

/**
 * Test Step 2: Get QuickBooks customer
 */
async function testGetQBCustomer(customerName) {
  console.log('\n👤 Step 2: Get QuickBooks customer');
  console.log('═'.repeat(70));
  console.log(`Customer name: ${customerName}`);

  try {
    // Search for customer
    console.log('🔍 Searching for customer in QuickBooks...');
    const searchResult = await makeQBRequest(`/customers/search?name=${encodeURIComponent(customerName)}`);

    if (searchResult?.customers && searchResult.customers.length > 0) {
      const customer = searchResult.customers[0];
      console.log(`✅ Found existing customer: ${customer.DisplayName} (ID: ${customer.Id})`);
      console.log(`   Currency: ${customer.CurrencyRef?.value || 'CAD'}`);
      console.log(`   Email: ${customer.PrimaryEmailAddr?.Address || 'N/A'}`);
      return customer;
    }

    // Customer not found
    console.log('⚠️  Customer not found in QuickBooks');
    console.log('💡 Tip: This test requires a customer that exists in both Supabase and QuickBooks');
    return null;

  } catch (error) {
    console.error('❌ Error searching for QuickBooks customer:', error.message || error);
    if (error.responseText) {
      console.error('Response:', error.responseText);
    }
    throw error;
  }
}

/**
 * Test Step 3: Generate invoice payload
 */
function generateInvoicePayload(qboCustomer, salesRecords, invoiceNumber) {
  console.log('\n📄 Step 3: Generate invoice payload');
  console.log('═'.repeat(70));

  const customerCurrency = qboCustomer.CurrencyRef?.value || 'CAD';
  const customerCurrencyName = {
    'CAD': 'Canadian Dollar',
    'USD': 'United States Dollar',
    'EUR': 'Euro'
  }[customerCurrency] || customerCurrency;

  // Calculate due date (30 days from now, then end of that month)
  const today = new Date();
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  const dueDate = new Date(thirtyDaysFromNow.getFullYear(), thirtyDaysFromNow.getMonth() + 1, 0);
  const formattedDueDate = dueDate.toISOString().split('T')[0];

  // Get appropriate item reference and tax code based on currency
  const itemMapping = {
    'CAD': { name: 'Development CAD', value: '3' },
    'USD': { name: 'Development USD', value: '7' },
    'EUR': { name: 'Development EUR', value: '8' }
  };
  const itemRef = itemMapping[customerCurrency] || itemMapping.CAD;
  const taxCodeRef = customerCurrency === 'CAD' ? 4 : 3;

  // Group records by product_name and unit_price
  const groupedRecords = new Map();

  salesRecords.forEach(record => {
    const description = record.product_name || 'Development';
    const unitPrice = Number(record.unit_price) || 0;
    const quantity = Number(record.quantity) || 0;
    const totalPrice = Number(record.total_price) || 0;

    const key = `${description}|${unitPrice}`;

    if (groupedRecords.has(key)) {
      const existing = groupedRecords.get(key);
      existing.totalQuantity += quantity;
      existing.totalAmount += totalPrice;
    } else {
      groupedRecords.set(key, {
        description,
        unitPrice,
        totalQuantity: quantity,
        totalAmount: totalPrice
      });
    }
  });

  // Create line items
  const lineItems = Array.from(groupedRecords.values()).map((group, index) => {
    const calculatedQuantity = group.unitPrice > 0
      ? group.totalAmount / group.unitPrice
      : group.totalQuantity;

    return {
      Amount: Math.round(group.totalAmount * 100) / 100,
      Description: group.description,
      DetailType: 'SalesItemLineDetail',
      LineNum: index + 1,
      SalesItemLineDetail: {
        ItemRef: itemRef,
        Qty: Math.round(calculatedQuantity * 100) / 100,
        TaxCodeRef: {
          value: taxCodeRef
        },
        UnitPrice: Math.round(group.unitPrice * 100) / 100
      }
    };
  });

  const invoicePayload = {
    BillEmail: {
      Address: qboCustomer.PrimaryEmailAddr?.Address || ''
    },
    CurrencyRef: {
      name: customerCurrencyName,
      value: customerCurrency
    },
    CustomerRef: {
      name: qboCustomer.DisplayName || qboCustomer.Name,
      value: qboCustomer.Id
    },
    DeliveryInfo: {
      DeliveryType: 'Email'
    },
    DocNumber: invoiceNumber,
    DueDate: formattedDueDate,
    GlobalTaxCalculation: 'TaxExcluded',
    Line: lineItems
  };

  console.log(`✅ Generated invoice payload:`);
  console.log(`   Customer: ${qboCustomer.DisplayName}`);
  console.log(`   Currency: ${customerCurrency}`);
  console.log(`   Doc Number: ${invoiceNumber}`);
  console.log(`   Due Date: ${formattedDueDate}`);
  console.log(`   Line Items: ${lineItems.length}`);
  console.log(`   Total Amount: $${lineItems.reduce((sum, line) => sum + line.Amount, 0).toFixed(2)}`);

  return invoicePayload;
}

/**
 * Test Step 4: Create invoice in QuickBooks
 */
async function testCreateInvoice(invoicePayload) {
  console.log('\n💳 Step 4: Create invoice in QuickBooks');
  console.log('═'.repeat(70));

  try {
    console.log('📤 Sending invoice to QuickBooks API...');
    const result = await makeQBRequest('/invoices', 'POST', invoicePayload);

    if (result.Fault) {
      const errorMessage = result.Fault.Error?.[0]?.Detail || 'Unknown error';
      throw new Error(`QuickBooks API error: ${errorMessage}`);
    }

    if (!result.Invoice) {
      throw new Error('No Invoice object in response');
    }

    const invoice = result.Invoice;
    console.log(`✅ Invoice created successfully`);
    console.log(`   Invoice ID: ${invoice.Id}`);
    console.log(`   Doc Number: ${invoice.DocNumber}`);
    console.log(`   Total Amount: $${invoice.TotalAmt}`);
    console.log(`   Balance: $${invoice.Balance}`);

    return invoice;

  } catch (error) {
    console.error('❌ Error creating invoice:', error.message);
    throw error;
  }
}

/**
 * Test Step 5: Mark records as billed
 */
async function testMarkRecordsBilled(recordIds, invoiceId) {
  console.log('\n✏️  Step 5: Mark records as billed via mark_records_billed RPC');
  console.log('═'.repeat(70));
  console.log(`Record IDs: ${recordIds.join(', ')}`);
  console.log(`Invoice ID: ${invoiceId}`);

  try {
    const { data, error } = await supabase.rpc('mark_records_billed', {
      p_record_ids: recordIds,
      p_invoice_id: invoiceId
    });

    if (error) {
      throw new Error(`RPC error: ${error.message}`);
    }

    console.log(`✅ Marked ${data} record(s) as billed`);

    if (data !== recordIds.length) {
      console.warn(`⚠️  Expected to update ${recordIds.length} records, but updated ${data}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Error marking records as billed:', error.message);
    throw error;
  }
}

/**
 * Test Step 6: Verify inv_id is set
 */
async function testVerifyInvoiceId(recordIds, expectedInvoiceId) {
  console.log('\n🔍 Step 6: Verify inv_id is set correctly');
  console.log('═'.repeat(70));

  try {
    const { data, error } = await supabase
      .from('customer_sales')
      .select('id, inv_id, product_name, total_price')
      .in('id', recordIds);

    if (error) {
      throw new Error(`Query error: ${error.message}`);
    }

    console.log(`📊 Verification results:`);
    let allCorrect = true;

    data.forEach(record => {
      const isCorrect = record.inv_id === expectedInvoiceId;
      console.log(`   ${isCorrect ? '✅' : '❌'} Record ${record.id}: inv_id = ${record.inv_id || 'NULL'}`);
      if (!isCorrect) {
        allCorrect = false;
      }
    });

    if (allCorrect) {
      console.log('\n✅ All records have correct inv_id');
    } else {
      console.log('\n❌ Some records have incorrect inv_id');
    }

    return allCorrect;

  } catch (error) {
    console.error('❌ Error verifying invoice IDs:', error.message);
    throw error;
  }
}

/**
 * Test Step 7: Verify records no longer in unbilled list
 */
async function testVerifyNotInUnbilledList(recordIds) {
  console.log('\n🔍 Step 7: Verify records no longer appear in unbilled list');
  console.log('═'.repeat(70));

  try {
    const { data, error } = await supabase.rpc('get_unpaid_records', {
      p_organization_id: ORG_ID,
      p_customer_id: null
    });

    if (error) {
      throw new Error(`RPC error: ${error.message}`);
    }

    const unbilledRecordIds = data.map(r => r.id);
    const foundInUnbilled = recordIds.filter(id => unbilledRecordIds.includes(id));

    if (foundInUnbilled.length === 0) {
      console.log('✅ No billed records found in unbilled list');
      return true;
    } else {
      console.log(`❌ Found ${foundInUnbilled.length} billed records still in unbilled list:`);
      foundInUnbilled.forEach(id => console.log(`   • ${id}`));
      return false;
    }

  } catch (error) {
    console.error('❌ Error verifying unbilled list:', error.message);
    throw error;
  }
}

/**
 * Main test execution
 */
async function runTest() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  QuickBooks Invoice Generation End-to-End Test                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    // Step 1: Fetch unbilled records
    const unbilledRecords = await testFetchUnbilledRecords();
    if (!unbilledRecords || unbilledRecords.length === 0) {
      console.log('\n⚠️  Test aborted: No unbilled records available');
      process.exit(0);
    }

    // Try to find a customer that exists in QuickBooks
    // Group records by customer
    const customerGroups = unbilledRecords.reduce((acc, record) => {
      const customerId = record.customer_id;
      if (!acc[customerId]) {
        acc[customerId] = {
          customerName: record.customer_name,
          records: []
        };
      }
      acc[customerId].records.push(record);
      return acc;
    }, {});

    let qboCustomer = null;
    let customerRecords = null;
    let customerName = null;

    // Try each customer until we find one that exists in QuickBooks
    for (const [customerId, group] of Object.entries(customerGroups)) {
      customerName = group.customerName;
      customerRecords = group.records;

      console.log(`\n🎯 Trying customer: ${customerName} (${customerRecords.length} unbilled records)`);

      // Step 2: Get QuickBooks customer
      qboCustomer = await testGetQBCustomer(customerName);

      if (qboCustomer) {
        console.log(`✅ Found matching QuickBooks customer!`);
        break;
      }

      console.log(`⏭️  Skipping customer, trying next one...`);
    }

    if (!qboCustomer) {
      console.log('\n⚠️  No customers found in QuickBooks. Test cannot proceed.');
      console.log('💡 Tip: Ensure at least one Supabase customer exists in QuickBooks');
      process.exit(0);
    }

    // Step 3: Generate invoice payload
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const invoiceNumber = `TEST-${qboCustomer.Id}-${year}${month}-${Date.now().toString().slice(-3)}`;
    const invoicePayload = generateInvoicePayload(qboCustomer, customerRecords, invoiceNumber);

    // Step 4: Create invoice
    const invoice = await testCreateInvoice(invoicePayload);

    // Step 5: Mark records as billed
    const recordIds = customerRecords.map(r => r.id);
    await testMarkRecordsBilled(recordIds, invoice.Id);

    // Step 6: Verify inv_id is set
    const verifyInvId = await testVerifyInvoiceId(recordIds, invoice.Id);

    // Step 7: Verify not in unbilled list
    const verifyNotUnbilled = await testVerifyNotInUnbilledList(recordIds);

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║  Test Summary                                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log(`Step 1: Fetch unbilled records     ✅ PASS (${unbilledRecords.length} records)`);
    console.log(`Step 2: Get/Create QB customer     ✅ PASS (${qboCustomer.DisplayName})`);
    console.log(`Step 3: Generate invoice payload   ✅ PASS (${invoicePayload.Line.length} line items)`);
    console.log(`Step 4: Create QB invoice          ✅ PASS (Invoice ${invoice.Id})`);
    console.log(`Step 5: Mark records as billed     ✅ PASS (${recordIds.length} records)`);
    console.log(`Step 6: Verify inv_id              ${verifyInvId ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Step 7: Verify not in unbilled     ${verifyNotUnbilled ? '✅ PASS' : '❌ FAIL'}`);

    const allTestsPassed = verifyInvId && verifyNotUnbilled;

    if (allTestsPassed) {
      console.log('\n🎉 ALL TESTS PASSED! Invoice generation flow is working correctly.');
      process.exit(0);
    } else {
      console.log('\n⚠️  SOME TESTS FAILED. Please review the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
runTest();
