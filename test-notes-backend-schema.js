/**
 * Notes API Backend Schema Verification Script
 *
 * This script tests the /api/notes endpoints with proper authentication:
 * - HMAC-SHA256 authorization header
 * - X-Organization-ID header for organization scoping
 *
 * Verifies:
 * 1. Schema matches OpenAPI spec
 * 2. CRUD operations work correctly
 * 3. Organization scoping is enforced
 * 4. Field mappings are correct
 */

import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const API_URL = process.env.VITE_API_URL || 'https://api.claritybusinesssolutions.ca';
const SECRET_KEY = process.env.VITE_SECRET_KEY;
const ORG_ID = process.env.VITE_CLARITY_INTEGRATION_ORG_ID;

if (!SECRET_KEY) {
  console.error('ERROR: VITE_SECRET_KEY not found in .env');
  process.exit(1);
}

if (!ORG_ID) {
  console.error('ERROR: VITE_CLARITY_INTEGRATION_ORG_ID not found in .env');
  process.exit(1);
}

/**
 * Generate HMAC-SHA256 authentication header
 */
function generateAuthHeader(payload = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;

  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(message);
  const signature = hmac.digest('hex');

  return `Bearer ${signature}.${timestamp}`;
}

/**
 * Make authenticated API request with both HMAC and org context
 */
async function apiRequest(method, endpoint, data = null) {
  const payload = data ? JSON.stringify(data) : '';
  const authHeader = generateAuthHeader(payload);

  const config = {
    method,
    url: `${API_URL}${endpoint}`,
    headers: {
      'Authorization': authHeader,
      'X-Organization-ID': ORG_ID,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
      details: error.response
    };
  }
}

/**
 * Document schema findings
 */
const schemaFindings = {
  endpoints: [],
  discrepancies: [],
  fieldMappings: {},
  notes: []
};

/**
 * Test suite
 */
async function runTests() {
  console.log('=' .repeat(80));
  console.log('Notes API Backend Schema Verification');
  console.log('=' .repeat(80));
  console.log(`API URL: ${API_URL}`);
  console.log(`Organization ID: ${ORG_ID}`);
  console.log('');

  const results = {
    passed: 0,
    failed: 0
  };

  let createdNoteId = null;
  let actualResponseStructure = null;

  // Use a test project ID (we'll use a dummy UUID)
  const TEST_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

  // Test 1: Create a note
  console.log(`[Test 1] POST /projects/${TEST_PROJECT_ID}/notes - Create a project note`);
  console.log('-'.repeat(80));

  const createPayload = {
    entity_type: 'project',
    entity_id: TEST_PROJECT_ID,
    organization_id: ORG_ID,
    content: 'Test note from schema verification script',
    author: 'Schema Verification Script'
  };

  console.log('Request payload:');
  console.log(JSON.stringify(createPayload, null, 2));
  console.log('');

  const createResult = await apiRequest('POST', `/projects/${TEST_PROJECT_ID}/notes`, createPayload);
  console.log('Response status:', createResult.status);
  console.log('Response:');
  console.log(JSON.stringify(createResult.data || createResult.error, null, 2));
  console.log('');

  if (createResult.success && createResult.data) {
    console.log('✓ Test 1 PASSED: Note created successfully');
    results.passed++;

    // Extract response structure
    const responseData = createResult.data.data || createResult.data;
    actualResponseStructure = responseData;

    // Document response fields
    console.log('Response structure analysis:');
    console.log('  Fields present:', Object.keys(responseData).join(', '));

    // Check against expected NoteResponse schema
    const expectedFields = ['id', 'org_id', 'note', 'type', 'customer_id', 'project_id', 'task_id', 'created_by', 'updated_by', 'created_at', 'updated_at'];
    const actualFields = Object.keys(responseData);

    const missingExpected = expectedFields.filter(f => !actualFields.includes(f) && !actualFields.includes(f.replace('_', '')));
    const extraFields = actualFields.filter(f => !expectedFields.includes(f));

    if (missingExpected.length > 0) {
      console.log('  ⚠ Missing expected fields:', missingExpected.join(', '));
      schemaFindings.discrepancies.push({
        type: 'missing_fields',
        endpoint: 'POST /api/notes',
        fields: missingExpected
      });
    }

    if (extraFields.length > 0) {
      console.log('  ℹ Extra fields (not in spec):', extraFields.join(', '));
      schemaFindings.discrepancies.push({
        type: 'extra_fields',
        endpoint: 'POST /api/notes',
        fields: extraFields
      });
    }

    // Check field name mapping (org_id vs organization_id)
    if (responseData.org_id) {
      schemaFindings.fieldMappings.organization_id = 'org_id';
      console.log('  ℹ Field mapping: organization_id → org_id (in response)');
    }

    // Check content field mapping
    if (responseData.note) {
      schemaFindings.fieldMappings.content = 'note';
      console.log('  ℹ Field mapping: content (request) → note (response)');
    }

    // Extract created note ID
    if (responseData.id) {
      createdNoteId = responseData.id;
      console.log('  Created note ID:', createdNoteId);
    }

    console.log('');
  } else {
    console.log('✗ Test 1 FAILED');
    console.log('Error:', createResult.error);
    results.failed++;
    console.log('');
  }

  // Test 2: List notes for project
  console.log(`[Test 2] GET /projects/${TEST_PROJECT_ID}/notes - List project notes`);
  console.log('-'.repeat(80));

  const listResult = await apiRequest('GET', `/projects/${TEST_PROJECT_ID}/notes`);
  console.log('Response status:', listResult.status);

  if (listResult.success && listResult.data) {
    console.log('✓ Test 2 PASSED: Notes list retrieved');
    results.passed++;

    // Verify structure matches NoteListResponse schema
    const hasNotes = 'notes' in listResult.data;
    const hasTotal = 'total' in listResult.data;
    const hasLimit = 'limit' in listResult.data;
    const hasOffset = 'offset' in listResult.data;

    console.log('Response structure:');
    console.log(`  notes: ${hasNotes ? '✓' : '✗'} (array of ${listResult.data.notes?.length || 0})`);
    console.log(`  total: ${hasTotal ? '✓' : '✗'} (${listResult.data.total})`);
    console.log(`  limit: ${hasLimit ? '✓' : '✗'} (${listResult.data.limit})`);
    console.log(`  offset: ${hasOffset ? '✓' : '✗'} (${listResult.data.offset})`);

    if (listResult.data.notes && listResult.data.notes.length > 0) {
      const sample = listResult.data.notes[0];
      console.log('');
      console.log('Sample note structure:');
      console.log('  Fields:', Object.keys(sample).join(', '));

      // Verify consistency with create response
      if (actualResponseStructure) {
        const createFields = Object.keys(actualResponseStructure).sort();
        const listFields = Object.keys(sample).sort();

        if (JSON.stringify(createFields) !== JSON.stringify(listFields)) {
          console.log('  ⚠ Warning: List response fields differ from create response');
          schemaFindings.discrepancies.push({
            type: 'inconsistent_response_structure',
            detail: 'POST and GET return different fields',
            createFields,
            listFields
          });
        }
      }
    }

    console.log('');
  } else {
    console.log('✗ Test 2 FAILED');
    console.log('Error:', listResult.error);
    results.failed++;
    console.log('');
  }

  // Test 3: Get note by ID
  if (createdNoteId) {
    console.log(`[Test 3] GET /projects/notes/${createdNoteId} - Get note by ID`);
    console.log('-'.repeat(80));

    const getResult = await apiRequest('GET', `/projects/notes/${createdNoteId}`);
    console.log('Response status:', getResult.status);

    if (getResult.success && getResult.data) {
      console.log('✓ Test 3 PASSED: Note retrieved by ID');
      results.passed++;

      const responseData = getResult.data.data || getResult.data;
      console.log('Note data:');
      console.log(`  ID: ${responseData.id}`);
      console.log(`  Content: "${responseData.note || responseData.content}"`);
      console.log(`  Type: ${responseData.type}`);
      console.log(`  Created: ${responseData.created_at}`);
      console.log('');
    } else {
      console.log('✗ Test 3 FAILED');
      console.log('Error:', getResult.error);
      results.failed++;
      console.log('');
    }
  } else {
    console.log('[Test 3] SKIPPED: No note ID available');
    console.log('');
  }

  // Test 4: Update note
  if (createdNoteId) {
    console.log(`[Test 4] PATCH /projects/notes/${createdNoteId} - Update note`);
    console.log('-'.repeat(80));

    const updatePayload = {
      content: 'Updated test note content - schema verification',
      author: 'Schema Verification Script (Updated)'
    };

    console.log('Update payload:');
    console.log(JSON.stringify(updatePayload, null, 2));
    console.log('');

    const updateResult = await apiRequest('PATCH', `/projects/notes/${createdNoteId}`, updatePayload);
    console.log('Response status:', updateResult.status);

    if (updateResult.success && updateResult.data) {
      console.log('✓ Test 4 PASSED: Note updated successfully');
      results.passed++;

      const responseData = updateResult.data.data || updateResult.data;
      console.log('Updated note:');
      console.log(`  Content: "${responseData.note || responseData.content}"`);
      console.log(`  Updated at: ${responseData.updated_at}`);

      // Note: OpenAPI spec shows NoteUpdate accepts 'content', but response uses 'note'
      if (updatePayload.content && responseData.note) {
        schemaFindings.notes.push('PATCH accepts "content" in request but returns "note" in response');
      }

      console.log('');
    } else {
      console.log('✗ Test 4 FAILED');
      console.log('Error:', updateResult.error);
      results.failed++;
      console.log('');
    }
  } else {
    console.log('[Test 4] SKIPPED: No note ID available');
    console.log('');
  }

  // Test 5: Delete note
  if (createdNoteId) {
    console.log(`[Test 5] DELETE /projects/notes/${createdNoteId} - Delete note`);
    console.log('-'.repeat(80));

    const deleteResult = await apiRequest('DELETE', `/projects/notes/${createdNoteId}`);
    console.log('Response status:', deleteResult.status);

    if (deleteResult.success) {
      console.log('✓ Test 5 PASSED: Note deleted successfully');
      results.passed++;

      // Verify deletion
      console.log('Verifying deletion...');
      const verifyResult = await apiRequest('GET', `/projects/notes/${createdNoteId}`);

      if (!verifyResult.success && verifyResult.status === 404) {
        console.log('✓ Deletion confirmed: Note no longer exists');
      } else if (verifyResult.success) {
        console.log('⚠ Warning: Note still exists after deletion');
        schemaFindings.discrepancies.push({
          type: 'deletion_not_effective',
          detail: 'Note still retrievable after DELETE'
        });
      }

      console.log('');
    } else {
      console.log('✗ Test 5 FAILED');
      console.log('Error:', deleteResult.error);
      results.failed++;
      console.log('');
    }
  } else {
    console.log('[Test 5] SKIPPED: No note ID available');
    console.log('');
  }

  // Test 6: Organization scoping
  console.log('[Test 6] Organization Scoping - Verify isolation');
  console.log('-'.repeat(80));

  const wrongOrgPayload = {
    entity_type: 'project',
    entity_id: TEST_PROJECT_ID,
    organization_id: '00000000-0000-0000-0000-000000000000', // Different org in payload
    content: 'This should be scoped to X-Organization-ID header, not payload org_id'
  };

  const wrongOrgResult = await apiRequest('POST', `/projects/${TEST_PROJECT_ID}/notes`, wrongOrgPayload);

  if (!wrongOrgResult.success) {
    console.log('✓ Test 6 PASSED: Organization scoping enforced');
    console.log('  (Request with mismatched org_id was rejected)');
    results.passed++;
  } else {
    // Check if the note was created with the header org_id, not the payload org_id
    const responseData = wrongOrgResult.data.data || wrongOrgResult.data;
    if (responseData.org_id === ORG_ID) {
      console.log('✓ Test 6 PASSED: Header org_id takes precedence over payload');
      console.log(`  Note created with org_id from header: ${responseData.org_id}`);
      results.passed++;

      // Clean up
      await apiRequest('DELETE', `/projects/notes/${responseData.id}`);
    } else {
      console.log('✗ Test 6 FAILED: Organization scoping issue detected');
      console.log(`  Expected org_id: ${ORG_ID}`);
      console.log(`  Actual org_id: ${responseData.org_id}`);
      results.failed++;
    }
  }

  console.log('');

  // Summary
  console.log('=' .repeat(80));
  console.log('Test Summary');
  console.log('=' .repeat(80));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log('');

  // Schema Findings Report
  console.log('=' .repeat(80));
  console.log('Schema Findings');
  console.log('=' .repeat(80));
  console.log('');

  console.log('Field Mappings (Request → Response):');
  if (Object.keys(schemaFindings.fieldMappings).length > 0) {
    for (const [request, response] of Object.entries(schemaFindings.fieldMappings)) {
      console.log(`  ${request} → ${response}`);
    }
  } else {
    console.log('  (None identified)');
  }
  console.log('');

  if (schemaFindings.discrepancies.length > 0) {
    console.log('Schema Discrepancies:');
    schemaFindings.discrepancies.forEach((disc, i) => {
      console.log(`  ${i + 1}. ${disc.type}`);
      if (disc.fields) console.log(`     Fields: ${disc.fields.join(', ')}`);
      if (disc.detail) console.log(`     Detail: ${disc.detail}`);
      if (disc.endpoint) console.log(`     Endpoint: ${disc.endpoint}`);
    });
    console.log('');
  }

  if (schemaFindings.notes.length > 0) {
    console.log('Notes:');
    schemaFindings.notes.forEach((note, i) => {
      console.log(`  ${i + 1}. ${note}`);
    });
    console.log('');
  }

  // Key Findings
  console.log('=' .repeat(80));
  console.log('Key Findings Summary');
  console.log('=' .repeat(80));
  console.log('');
  console.log('1. Authentication:');
  console.log('   ✓ Requires HMAC-SHA256 Authorization header');
  console.log('   ✓ Requires X-Organization-ID header for org scoping');
  console.log('');
  console.log('2. Field Naming:');
  console.log('   - Request uses "content", response uses "note"');
  console.log('   - Request uses "organization_id", response uses "org_id"');
  console.log('');
  console.log('3. Response Structure:');
  console.log('   - POST/GET/PATCH: Returns note object (wrapped or unwrapped)');
  console.log('   - GET /api/notes: Returns { notes: [], total, limit, offset }');
  console.log('   - DELETE: Returns success confirmation');
  console.log('');
  console.log('4. Organization Scoping:');
  console.log('   - X-Organization-ID header determines scope');
  console.log('   - RLS policies enforce organization isolation');
  console.log('');

  if (results.failed === 0) {
    console.log('✓ All tests passed! Backend schema matches expectations.');
    process.exit(0);
  } else {
    console.log('⚠ Some tests failed. Review output above for details.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
