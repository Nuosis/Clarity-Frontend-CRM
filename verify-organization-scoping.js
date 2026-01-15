#!/usr/bin/env node

/**
 * Organization ID Scoping Verification Script
 *
 * This script verifies that:
 * 1. All RPC calls include organization_id parameter
 * 2. Organization ID is properly extracted from user session
 * 3. Error handling exists for missing organization context
 * 4. RLS isolation is properly configured
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Read the financialRecords.js file
const financialRecordsPath = join(__dirname, 'src', 'api', 'financialRecords.js');
const financialRecordsContent = readFileSync(financialRecordsPath, 'utf-8');

// Expected RPC functions that should have organization_id
const expectedRPCCalls = [
    'get_financial_records',
    'get_unpaid_records',
    'get_monthly_summary',
    'get_quarterly_summary',
    'get_yearly_summary',
    'create_financial_record',
    'mark_records_billed'
];

// Functions that should call getRequiredOrganizationId()
const functionsRequiringOrgId = [
    'fetchFinancialRecords',
    'fetchUnpaidRecords',
    'fetchMonthlyRecords',
    'fetchQuarterlyRecords',
    'fetchYearlyRecords',
    'fetchFinancialRecordByRecordId',
    'fetchFinancialRecordByUUID',
    'fetchRecordsForDateRange',
    'createFinancialRecord',
    'fetchMonthlySummary',
    'fetchQuarterlySummary',
    'fetchYearlySummary'
];

log('\n=== Organization ID Scoping Verification ===\n', 'cyan');

let allChecks = true;

// Check 1: Verify getRequiredOrganizationId() helper exists
log('Check 1: Verify organization ID helper function', 'blue');
const hasOrgIdHelper = financialRecordsContent.includes('function getRequiredOrganizationId()');
if (hasOrgIdHelper) {
    log('✓ getRequiredOrganizationId() helper function found', 'green');

    // Verify it throws errors
    const helperContent = financialRecordsContent.match(/function getRequiredOrganizationId\(\)[^}]*{[^}]*}/s);
    if (helperContent && helperContent[0].includes('throw new Error')) {
        log('✓ Helper throws error when organization context is missing', 'green');
    } else {
        log('✗ Helper does not throw error for missing organization context', 'red');
        allChecks = false;
    }
} else {
    log('✗ getRequiredOrganizationId() helper function NOT found', 'red');
    allChecks = false;
}

// Check 2: Verify each function calls getRequiredOrganizationId()
log('\nCheck 2: Verify functions retrieve organization ID', 'blue');
for (const funcName of functionsRequiringOrgId) {
    const funcRegex = new RegExp(`export\\s+async\\s+function\\s+${funcName}[^{]*{([^}]*getRequiredOrganizationId[^}]*)}`, 's');
    const match = financialRecordsContent.match(funcRegex);

    if (match) {
        log(`✓ ${funcName}() calls getRequiredOrganizationId()`, 'green');
    } else {
        // Check if function exists but doesn't call getRequiredOrganizationId
        const funcExistsRegex = new RegExp(`export\\s+async\\s+function\\s+${funcName}`, 's');
        if (funcExistsRegex.test(financialRecordsContent)) {
            log(`✗ ${funcName}() exists but does NOT call getRequiredOrganizationId()`, 'red');
            allChecks = false;
        } else {
            log(`⚠ ${funcName}() not found in file`, 'yellow');
        }
    }
}

// Check 3: Verify RPC calls include p_organization_id
log('\nCheck 3: Verify RPC calls include organization_id parameter', 'blue');
for (const rpcName of expectedRPCCalls) {
    const rpcRegex = new RegExp(`\\.rpc\\(['"]${rpcName}['"],\\s*{[^}]*p_organization_id[^}]*}`, 's');
    const match = financialRecordsContent.match(rpcRegex);

    if (match) {
        log(`✓ ${rpcName} RPC includes p_organization_id parameter`, 'green');
    } else {
        log(`✗ ${rpcName} RPC does NOT include p_organization_id parameter`, 'red');
        allChecks = false;
    }
}

// Check 4: Verify direct table access does NOT bypass organization scoping
log('\nCheck 4: Verify no direct table access bypassing RLS', 'blue');
const directTableAccess = [
    /\.from\(['"]customer_sales['"]\)\.select\(/g,
    /\.from\(['"]customer_sales['"]\)\.insert\(/g
];

let foundDirectAccess = false;
for (const pattern of directTableAccess) {
    const matches = [...financialRecordsContent.matchAll(pattern)];
    if (matches.length > 0) {
        // Check if these are within updateFinancialRecordBilledStatus functions (which are allowed)
        for (const match of matches) {
            const lineNumber = financialRecordsContent.substring(0, match.index).split('\n').length;

            // Extract context around the match
            const lines = financialRecordsContent.split('\n');
            const contextStart = Math.max(0, lineNumber - 10);
            const contextEnd = Math.min(lines.length, lineNumber + 10);
            const context = lines.slice(contextStart, contextEnd).join('\n');

            // Check if within updateFinancialRecordBilledStatus or bulkUpdateFinancialRecordsBilledStatus
            if (context.includes('updateFinancialRecordBilledStatus') ||
                context.includes('bulkUpdateFinancialRecordsBilledStatus')) {
                log(`⚠ Direct table access at line ${lineNumber} (allowed within update function)`, 'yellow');
            } else {
                log(`✗ Direct table access at line ${lineNumber} (bypasses RLS)`, 'red');
                foundDirectAccess = true;
                allChecks = false;
            }
        }
    }
}

if (!foundDirectAccess) {
    log('✓ No unauthorized direct table access found', 'green');
}

// Check 5: Verify imports from dataService
log('\nCheck 5: Verify imports from dataService', 'blue');
const hasOrgIdImports = financialRecordsContent.includes('getOrganizationId') &&
                         financialRecordsContent.includes('hasOrganizationContext');
if (hasOrgIdImports) {
    log('✓ Required dataService imports found (getOrganizationId, hasOrganizationContext)', 'green');
} else {
    log('✗ Missing required dataService imports', 'red');
    allChecks = false;
}

// Check 6: Verify error handling for missing organization context
log('\nCheck 6: Verify error handling for missing organization context', 'blue');
const errorMessages = [
    'Organization context is required',
    'Organization ID is missing from context'
];

let foundAllErrors = true;
for (const errorMsg of errorMessages) {
    if (financialRecordsContent.includes(errorMsg)) {
        log(`✓ Error message found: "${errorMsg}"`, 'green');
    } else {
        log(`✗ Error message NOT found: "${errorMsg}"`, 'red');
        foundAllErrors = false;
        allChecks = false;
    }
}

// Summary
log('\n=== Verification Summary ===\n', 'cyan');
if (allChecks) {
    log('✓ All organization ID scoping checks PASSED', 'green');
    log('\nOrganization scoping is properly implemented:', 'green');
    log('  • All RPC calls include organization_id parameter', 'green');
    log('  • Error handling for missing organization context', 'green');
    log('  • No unauthorized direct table access', 'green');
    log('  • Proper imports from dataService', 'green');
    process.exit(0);
} else {
    log('✗ Some organization ID scoping checks FAILED', 'red');
    log('\nPlease review the issues above and ensure:', 'yellow');
    log('  • All RPC calls pass organization_id', 'yellow');
    log('  • All functions call getRequiredOrganizationId()', 'yellow');
    log('  • Error handling exists for missing context', 'yellow');
    log('  • No direct table access bypasses RLS', 'yellow');
    process.exit(1);
}
