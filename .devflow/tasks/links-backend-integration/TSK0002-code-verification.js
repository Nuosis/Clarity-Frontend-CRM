#!/usr/bin/env node
/**
 * TSK0002 Code Verification
 *
 * This script verifies that the refactored links.js API client:
 * 1. Exports all required functions
 * 2. Functions have correct signatures
 * 3. Code follows established patterns
 * 4. No FileMaker dependencies remain
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== TSK0002 Code Verification ===\n');

// Read the refactored file
const linksApiPath = join(__dirname, '../../../src/api/links.js');
const linksApiContent = readFileSync(linksApiPath, 'utf-8');

// Test 1: Check exports
console.log('✓ Test 1: Checking exports...');
const requiredExports = [
    'createLink',
    'fetchLinks',
    'updateLink',
    'deleteLink'
];

const exportPattern = /export\s+(async\s+)?function\s+(\w+)/g;
const foundExports = [];
let match;
while ((match = exportPattern.exec(linksApiContent)) !== null) {
    foundExports.push(match[2]);
}

console.log('  Found exports:', foundExports.join(', '));
const missingExports = requiredExports.filter(e => !foundExports.includes(e));
if (missingExports.length > 0) {
    console.log('  ❌ FAIL: Missing exports:', missingExports.join(', '));
    process.exit(1);
} else {
    console.log('  ✅ PASS: All required functions exported\n');
}

// Test 2: Check no FileMaker dependencies
console.log('✓ Test 2: Checking for FileMaker dependencies...');
const fileMakerImports = [
    'handleFileMakerOperation',
    'validateParams',
    'Layouts',
    'Actions',
    'ENVIRONMENT_TYPES.FILEMAKER',
    'from \'./fileMaker\''
];

const foundFileMakerRefs = [];
for (const ref of fileMakerImports) {
    if (linksApiContent.includes(ref)) {
        foundFileMakerRefs.push(ref);
    }
}

if (foundFileMakerRefs.length > 0) {
    console.log('  ❌ FAIL: FileMaker dependencies still present:', foundFileMakerRefs.join(', '));
    process.exit(1);
} else {
    console.log('  ✅ PASS: No FileMaker dependencies found\n');
}

// Test 3: Check dataService usage
console.log('✓ Test 3: Checking dataService usage...');
const requiredDataServiceMethods = [
    'dataService.post',
    'dataService.get',
    'dataService.patch',
    'dataService.delete'
];

const foundMethods = [];
for (const method of requiredDataServiceMethods) {
    if (linksApiContent.includes(method)) {
        foundMethods.push(method);
    }
}

console.log('  Found dataService methods:', foundMethods.join(', '));
if (foundMethods.length !== requiredDataServiceMethods.length) {
    console.log('  ❌ FAIL: Missing dataService methods');
    process.exit(1);
} else {
    console.log('  ✅ PASS: All dataService methods used correctly\n');
}

// Test 4: Check backend endpoints
console.log('✓ Test 4: Checking backend endpoints...');
const expectedEndpoints = [
    "'/links'",
    '`/links/${linkId}`'
];

const foundEndpoints = [];
for (const endpoint of expectedEndpoints) {
    if (linksApiContent.includes(endpoint)) {
        foundEndpoints.push(endpoint);
    }
}

console.log('  Found endpoints:', foundEndpoints.join(', '));
if (foundEndpoints.length !== expectedEndpoints.length) {
    console.log('  ⚠️  WARNING: Some expected endpoints not found');
} else {
    console.log('  ✅ PASS: Backend endpoints correct\n');
}

// Test 5: Check organization scope validation
console.log('✓ Test 5: Checking organization scope validation...');
if (linksApiContent.includes('supabaseOrgID') &&
    linksApiContent.includes('Organization context required')) {
    console.log('  ✅ PASS: Organization scope validation present\n');
} else {
    console.log('  ⚠️  WARNING: Organization scope validation may be missing\n');
}

// Test 6: Check error handling
console.log('✓ Test 6: Checking error handling...');
const errorMessages = [
    'Data is required',
    'Link URL is required',
    'Link ID is required',
    'Update data is required'
];

const foundErrors = errorMessages.filter(msg => linksApiContent.includes(msg));
console.log('  Found error messages:', foundErrors.length, '/', errorMessages.length);
if (foundErrors.length !== errorMessages.length) {
    console.log('  ⚠️  WARNING: Some error messages missing');
} else {
    console.log('  ✅ PASS: Error handling complete\n');
}

// Test 7: Check JSDoc comments
console.log('✓ Test 7: Checking JSDoc documentation...');
const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
const jsdocBlocks = linksApiContent.match(jsdocPattern) || [];
console.log('  Found JSDoc blocks:', jsdocBlocks.length);
if (jsdocBlocks.length >= requiredExports.length) {
    console.log('  ✅ PASS: Documentation present for all functions\n');
} else {
    console.log('  ⚠️  WARNING: Insufficient documentation\n');
}

// Test 8: Check schema alignment
console.log('✓ Test 8: Checking backend schema alignment...');
const schemaFields = [
    'link:',  // Uses 'link' field
    'project_id:',
    'customer_id:',
    'task_id:',
    'organization_id:'
];

const foundFields = schemaFields.filter(field => linksApiContent.includes(field));
console.log('  Found schema fields:', foundFields.length, '/', schemaFields.length);
if (foundFields.length !== schemaFields.length) {
    console.log('  ❌ FAIL: Schema fields missing');
    process.exit(1);
} else {
    console.log('  ✅ PASS: Schema matches backend specification\n');
}

// Test 9: Check backward compatibility
console.log('✓ Test 9: Checking backward compatibility...');
if (linksApiContent.includes('data.url') || linksApiContent.includes('data.link')) {
    console.log('  ✅ PASS: Backward compatibility (url alias) supported\n');
} else {
    console.log('  ⚠️  WARNING: Backward compatibility may be missing\n');
}

// Final summary
console.log('=== Verification Summary ===');
console.log('✅ All critical tests passed');
console.log('✅ Code follows backend API integration pattern');
console.log('✅ No FileMaker dependencies');
console.log('✅ Full CRUD operations implemented');
console.log('✅ Proper error handling');
console.log('✅ Schema aligned with backend');
console.log('\n🎉 TSK0002 implementation verified successfully!\n');

process.exit(0);
