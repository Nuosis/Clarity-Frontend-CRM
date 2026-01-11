# QuickBooks Migration - Acceptance Criteria and Test Plan

**Document Version:** 1.0.0
**Date:** 2026-01-11
**Status:** Requirements Documentation
**Migration Priority:** High

---

## Table of Contents

1. [Overview](#overview)
2. [Success Criteria](#success-criteria)
3. [Functional Acceptance Criteria](#functional-acceptance-criteria)
4. [Non-Functional Acceptance Criteria](#non-functional-acceptance-criteria)
5. [Test Plan](#test-plan)
6. [Test Cases](#test-cases)
   - [OAuth Flow Tests](#oauth-flow-tests)
   - [Token Lifecycle Tests](#token-lifecycle-tests)
   - [Invoice Generation Tests](#invoice-generation-tests)
   - [Error Handling Tests](#error-handling-tests)
   - [Retry Logic Tests](#retry-logic-tests)
   - [Edge Case Tests](#edge-case-tests)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [Integration Testing](#integration-testing)
10. [User Acceptance Testing](#user-acceptance-testing)
11. [Test Data Requirements](#test-data-requirements)
12. [Test Environment Setup](#test-environment-setup)
13. [Rollback Testing](#rollback-testing)
14. [Sign-Off Criteria](#sign-off-criteria)

---

## Overview

This document defines the acceptance criteria and comprehensive test plan for migrating QuickBooks invoice generation from the legacy FileMaker script-based system to the modern backend API architecture.

**Migration Scope:**
- Replace FileMaker `initializeQuickBooks` function with backend API calls
- Direct Supabase integration for customer sales data
- Real-time user feedback for invoice operations
- Comprehensive error handling and retry logic
- Multi-tenant organization isolation

**Migration Goals:**
1. ✅ Zero data loss during migration
2. ✅ Improved user experience with real-time feedback
3. ✅ Enhanced error visibility and handling
4. ✅ Performance meets or exceeds current system
5. ✅ Maintains all existing business logic
6. ✅ Seamless rollback capability

---

## Success Criteria

### Primary Success Metrics

**Technical Completeness:**
- [ ] 100% of invoice generation flows use backend API (not FileMaker)
- [ ] 0 FileMaker `initializeQuickBooks` calls in production logs
- [ ] All backend API endpoints verified working
- [ ] Build succeeds without errors
- [ ] No console errors during normal operation

**Reliability:**
- [ ] ≥95% invoice creation success rate
- [ ] ≤5% error rate across all operations
- [ ] 0 data loss incidents
- [ ] 0 duplicate invoices created
- [ ] All errors logged and surfaced to users

**Performance:**
- [ ] Invoice generation completes in <10 seconds (95th percentile)
- [ ] Average invoice generation time <5 seconds
- [ ] Token refresh happens transparently (<2 seconds)
- [ ] No degradation in UI responsiveness

**User Experience:**
- [ ] Users receive immediate feedback on invoice creation
- [ ] Error messages are clear and actionable
- [ ] Invoice details (number, total, email status) displayed
- [ ] Loading indicators show progress
- [ ] ≥90% positive user feedback

**Security:**
- [ ] Organization isolation enforced (multi-tenant safety)
- [ ] No OAuth tokens exposed to frontend
- [ ] HMAC authentication working correctly
- [ ] No security vulnerabilities introduced

---

## Functional Acceptance Criteria

### AC1: OAuth Authorization Flow

**Given** a user needs to connect QuickBooks to their organization
**When** they click "Connect QuickBooks" button
**Then** the system should:
- Generate a valid QuickBooks OAuth authorization URL
- Include required scope: `com.intuit.quickbooks.accounting`
- Include CSRF state token for security
- Redirect user to QuickBooks authorization page
- Handle user authorization or denial gracefully
- Exchange authorization code for tokens on callback
- Store tokens securely in backend (encrypted, org-scoped)
- Never expose tokens to frontend
- Display success message with connection confirmation

**Code References:**
- Authorization URL generation: `src/api/quickbooksApi.js:195-203`
- OAuth callback handling: `src/api/quickbooksApi.js:206-216`
- Authorization specification: `authorization.md:227-289`

---

### AC2: Token Lifecycle Management

**Given** an organization has a connected QuickBooks account
**When** the access token expires (1 hour lifespan)
**Then** the system should:
- Automatically detect expired token on next API call
- Refresh token using stored refresh token
- Update stored tokens in database
- Retry original API request with new token
- Complete operation without user intervention
- Not interrupt user workflow

**Given** the refresh token expires (100 days)
**When** the system attempts to refresh an expired token
**Then** the system should:
- Detect refresh token expiration
- Clear stored connection data
- Display re-authorization prompt to user
- Provide "Reconnect QuickBooks" button
- Log disconnection event
- Handle re-authorization flow

**Code References:**
- Token refresh: `src/api/quickbooksApi.js:218-226`
- Token lifecycle: `authorization.md:353-393`

---

### AC3: Invoice Generation from Customer Sales

**Given** a customer has unbilled customer sales records
**When** user triggers "Send to QuickBooks" action
**Then** the system should:
- Fetch unbilled records from Supabase `customer_sales` table
- Validate records exist (error if none found)
- Search for QuickBooks customer by name
- Prompt to create QB customer if not found
- Generate invoice payload following business rules
- Create invoice in QuickBooks via backend API
- Return invoice details (ID, DocNumber, TotalAmt, EmailStatus)
- Update customer_sales records with `inv_id`
- Display success message with invoice number and total
- Send invoice email if customer has email address
- Refresh financial data display

**Code References:**
- Invoice creation: `src/api/quickbooksApi.js:281-294`
- Invoice payload generation: `src/services/invoiceGenerationService.js:26-84`
- Business rules: `api-contracts.md:1908-2099`

---

### AC4: Fixed-Price Project Detection

**Given** a timer is stopped on a task under a fixed-price project
**When** the system creates a financial record
**Then** the system should:
- Check project `f_fixedPrice` field
- Skip customer_sales record creation if `f_fixedPrice > 0`
- Log skip reason in console
- Return success without creating invoice line item
- Not generate any QuickBooks invoice line

**Given** a timer is stopped on a task under an hourly project
**When** the system creates a financial record
**Then** the system should:
- Create customer_sales record in Supabase
- Calculate quantity (hours worked)
- Resolve hourly rate (project > staff > org default)
- Calculate total_price (quantity * unit_price)
- Format product_name ({CUSTOMER_CAPS}:{PROJECT_WORD})
- Set inv_id to NULL (unbilled)
- Return created record ID

**Code References:**
- Fixed-price detection: `src/services/taskService.js:104-111`
- Business rule: `api-contracts.md:1909-1928`

---

### AC5: Product Name Formatting

**Given** a customer sales record needs a product name
**When** the system formats the product name
**Then** the system should:
- Extract capital letters and numbers from customer name
- Get first word of project name
- Combine with colon separator: `{CAPS}:{WORD}`
- Examples:
  - "Clarity Business Solutions" + "Website Redesign" → "CBS:Website"
  - "MacSpec Inc." + "McBride System" → "MI:McBride"
  - "ABC Corp 123" + "Development Project" → "ABC123:Development"

**Code References:**
- Product name formatting: `src/services/invoiceGenerationService.js:290-315`
- Business rule: `api-contracts.md:1946-1972`

---

### AC6: Hourly Rate Resolution

**Given** a customer sales record needs an hourly rate
**When** the system resolves the rate
**Then** the system should follow this priority:
1. Project-level rate (`f_hourlyRate > 0`) - Use this first
2. Staff-level rate (`f_HourlyRate > 0`) - Fallback to this
3. Organization default rate - Third priority
4. Default to 0 - Final fallback

**Code References:**
- Rate resolution: `src/services/salesService.js:50-75`
- Business rule: `api-contracts.md:1933-1942`

---

### AC7: Tax Code and Item Reference Mapping

**Given** a customer has a specified currency
**When** the system generates an invoice
**Then** the system should apply correct tax and item codes:

| Currency | Tax Code | Item Reference | Item Name |
|----------|----------|----------------|-----------|
| CAD | 4 | 3 | Development CAD |
| USD | 3 | 7 | Development USD |
| EUR | 3 | 8 | Development EUR |
| GBP | 3 | 3 | Development CAD (fallback) |
| AUD | 3 | 3 | Development CAD (fallback) |

**Code References:**
- Tax code logic: `src/services/invoiceGenerationService.js:178-190`
- Item mapping: `src/services/invoiceGenerationService.js:192-208`
- Business rules: `api-contracts.md:2010-2051`

---

### AC8: Invoice Document Number Generation

**Given** a new invoice is being created
**When** the system generates the document number
**Then** the system should:
- Use format: `{qboCustomerId}{YY}{MM}{NNN}`
- Components:
  - `qboCustomerId` - QB customer ID (e.g., 140)
  - `YY` - Last 2 digits of year (e.g., 25 for 2025)
  - `MM` - Month with leading zero (e.g., 06 for June)
  - `NNN` - Sequential invoice number for customer/month (001, 002, etc.)
- Examples:
  - Customer 140, June 2025, 1st invoice → `140250601`
  - Customer 12, January 2026, 3rd invoice → `122601003`
- Query existing invoices to determine next sequence number
- Handle month rollovers (reset sequence to 001)

**Code References:**
- Document number generation: `src/services/invoiceGenerationService.js:87-107`
- Business rule: `api-contracts.md:1977-2006`

---

### AC9: Due Date Calculation

**Given** an invoice is being created
**When** the system calculates the due date
**Then** the system should:
- Use latest date from sales records as invoice date
- Add 30 days to invoice date
- Calculate end of that month
- Return date in YYYY-MM-DD format
- Examples:
  - Invoice Date: Jan 10, 2026 → +30 days = Feb 9 → EOM = Feb 28, 2026
  - Invoice Date: Jan 31, 2026 → +30 days = Mar 2 → EOM = Mar 31, 2026

**Code References:**
- Due date calculation: `src/services/invoiceGenerationService.js:210-226`
- Business rule: `api-contracts.md:2053-2085`

---

### AC10: Line Item Grouping

**Given** multiple customer sales records for same project
**When** the system generates invoice line items
**Then** the system should:
- Group by product_name and unit_price
- Consolidate quantities for matching groups
- Create one line item per unique product/price combination
- Calculate line total: quantity * unit_price
- Round amounts to 2 decimal places
- Example:
  - Record 1: CBS:Website, 2 hrs @ $150 = $300
  - Record 2: CBS:Website, 3 hrs @ $150 = $450
  - Result: CBS:Website, 5 hrs @ $150 = $750 (single line item)

**Code References:**
- Line item grouping: `src/services/invoiceGenerationService.js:228-260`
- Business rule: `api-contracts.md:2088-2099`

---

## Non-Functional Acceptance Criteria

### NF1: Performance

- Invoice generation completes in <10 seconds (95th percentile)
- Average invoice generation time <5 seconds
- Token refresh <2 seconds
- No UI blocking during operations
- Parallel requests where possible

### NF2: Security

- HMAC signatures valid for all backend requests
- Organization ID enforced at all layers (frontend, backend, database)
- No OAuth tokens stored in frontend (localStorage, sessionStorage, cookies)
- All API calls over HTTPS
- CSRF protection via OAuth state parameter
- RLS policies enforce organization isolation

### NF3: Reliability

- 95%+ success rate for invoice generation
- Automatic retry on transient failures (network errors)
- Exponential backoff for rate limit errors
- No data corruption on failure
- Rollback capability tested and verified

### NF4: Usability

- Loading indicators during all async operations
- Success messages include invoice details
- Error messages are specific and actionable
- No silent failures (all errors logged and shown)
- Clear guidance when customer not found in QB

### NF5: Maintainability

- Code follows existing project patterns
- No TODO/FIXME/HACK comments in completed code
- Deprecated functions clearly marked
- Migration path documented
- Rollback procedure documented

---

## Test Plan

### Testing Approach

**Test Pyramid:**
```
         /\
        /E2\      End-to-End Tests (10%)
       /----\     - Full user workflows
      /  INT \    Integration Tests (30%)
     /--------\   - Service + API integration
    /  MANUAL  \  Manual Tests (60%)
   /------------\ - Functional validation
```

**Test Phases:**
1. **Unit Testing** - Manual verification of individual functions
2. **Integration Testing** - Service layer + API endpoint integration
3. **End-to-End Testing** - Complete user workflows
4. **Performance Testing** - Load and stress testing
5. **Security Testing** - Authentication and authorization validation
6. **User Acceptance Testing** - Real user validation

**Test Environments:**
- **Development:** Local Vite server + Backend dev API
- **Staging:** Staging server + QuickBooks sandbox
- **Production:** Production server + QuickBooks production (phased rollout)

---

## Test Cases

### OAuth Flow Tests

#### TC-OAuth-001: Successful QuickBooks Authorization

**Preconditions:**
- User is logged into Clarity CRM
- QuickBooks connection does not exist for organization

**Test Steps:**
1. Navigate to QuickBooks settings
2. Click "Connect QuickBooks" button
3. Verify redirect to QuickBooks OAuth page
4. Log into QuickBooks (if needed)
5. Select company to connect
6. Click "Authorize" button
7. Verify redirect back to Clarity CRM

**Expected Results:**
- Authorization URL contains correct scope
- State parameter is present
- QuickBooks login page loads
- After authorization, callback URL is called
- Success message displayed: "QuickBooks connected successfully"
- Connection status shows "Connected"
- OAuth tokens stored in backend (verify via DB query)
- Tokens NOT visible in browser localStorage/sessionStorage

**Code References:**
- Authorization flow: `src/api/quickbooksApi.js:195-203`
- OAuth specification: `authorization.md:227-289`

---

#### TC-OAuth-002: User Denies Authorization

**Preconditions:**
- User is at QuickBooks authorization page

**Test Steps:**
1. Click "Deny" button on QuickBooks authorization page
2. Verify redirect back to Clarity CRM

**Expected Results:**
- Callback receives `error=access_denied` parameter
- User sees info message: "QuickBooks connection cancelled"
- No error shown (user intentionally cancelled)
- No connection created in database
- UI shows "Connect QuickBooks" button (unchanged state)

**Code References:**
- Error handling: `authorization.md:874-889`

---

#### TC-OAuth-003: CSRF Attack Prevention (Invalid State)

**Preconditions:**
- Attacker attempts to forge callback with invalid state parameter

**Test Steps:**
1. Manually craft callback URL with invalid state token
2. Navigate to forged callback URL

**Expected Results:**
- Backend rejects callback with error
- Error message: "Invalid QuickBooks authorization. Please try again."
- No tokens stored
- User returned to safe state
- Security event logged

**Code References:**
- CSRF protection: `authorization.md:804-816`
- Error handling: `authorization.md:892-902`

---

#### TC-OAuth-004: Multiple Company Selection

**Preconditions:**
- User has access to multiple QuickBooks companies

**Test Steps:**
1. Start OAuth flow
2. At QuickBooks authorization page, select Company A
3. Complete authorization
4. Verify connection to Company A
5. Disconnect QuickBooks
6. Start OAuth flow again
7. Select Company B
8. Complete authorization

**Expected Results:**
- First connection stores Company A realm ID
- After disconnection, Company A tokens removed
- Second connection stores Company B realm ID
- Only one connection exists at a time (constraint enforced)
- No residual data from Company A

**Code References:**
- Connection uniqueness: `authorization.md:546-550`

---

### Token Lifecycle Tests

#### TC-Token-001: Automatic Access Token Refresh

**Preconditions:**
- Organization has connected QuickBooks
- Access token is expired (past 1 hour)

**Test Steps:**
1. Trigger invoice generation (or any QB API call)
2. Backend detects expired access token
3. Automatic refresh occurs
4. Original request retried with new token

**Expected Results:**
- Backend detects token expiration
- Refresh request sent to QuickBooks
- New access token received
- New refresh token received
- Tokens updated in database
- Original API call succeeds
- User sees no error or interruption
- Total time delay <2 seconds

**Code References:**
- Token refresh: `src/api/quickbooksApi.js:218-226`
- Refresh flow: `authorization.md:353-393`

---

#### TC-Token-002: Refresh Token Expiration

**Preconditions:**
- Organization has connected QuickBooks
- Refresh token is expired (past 100 days)

**Test Steps:**
1. Attempt to create invoice
2. Backend tries to refresh expired token
3. QuickBooks returns error: `invalid_grant`

**Expected Results:**
- Backend detects refresh token expired
- Connection record deleted from database
- Error returned to frontend: `REFRESH_TOKEN_EXPIRED`
- User sees warning message: "QuickBooks connection expired. Please reconnect."
- "Connect QuickBooks" button shown
- No invoice created (operation aborted)

**Code References:**
- Refresh token expiration: `authorization.md:909-924`

---

#### TC-Token-003: Token Revoked by User in QuickBooks

**Preconditions:**
- User revokes Clarity CRM access via QuickBooks settings

**Test Steps:**
1. User goes to QuickBooks App Management
2. Revokes access to Clarity CRM
3. User attempts to create invoice in Clarity CRM

**Expected Results:**
- Backend receives `invalid_grant` error from QuickBooks
- Connection record cleared from database
- User sees error: "QuickBooks connection lost. Please reconnect."
- "Reconnect QuickBooks" button displayed
- Revocation logged for audit

**Code References:**
- Revoked token handling: `authorization.md:927-937`

---

#### TC-Token-004: Manual Token Refresh

**Preconditions:**
- Organization has connected QuickBooks
- Access token is still valid

**Test Steps:**
1. Call `refreshQBOToken()` manually
2. Backend performs token refresh

**Expected Results:**
- Refresh succeeds even if token not expired
- New tokens received and stored
- Success response returned
- No errors logged

**Code References:**
- Manual refresh: `src/api/quickbooksApi.js:218-226`

---

### Invoice Generation Tests

#### TC-Invoice-001: Generate Invoice - Single Project, Happy Path

**Preconditions:**
- Customer exists in both Clarity CRM and QuickBooks
- Customer has 5 unbilled customer_sales records
- All records for same project
- Project is hourly (not fixed-price)

**Test Steps:**
1. Navigate to Financial Activity panel
2. Filter for customer with unbilled records
3. Click "Send to QuickBooks" button
4. Wait for operation to complete

**Expected Results:**
- Loading indicator shows "Generating QuickBooks invoice..."
- Backend fetches 5 unbilled records
- QuickBooks customer found via search
- Invoice payload generated correctly
- Invoice created in QuickBooks
- Success message: "Invoice {DocNumber} created successfully! Total: ${TotalAmt}"
- All 5 customer_sales records updated with inv_id
- Invoice details displayed (number, total, email status)
- Financial data refreshed (unbilled records no longer shown)
- Total time <10 seconds

**Test Data:**
- Customer: "Test Customer Inc."
- Project: "Website Redesign"
- 5 records × 2 hours @ $150/hr = $1,500 total
- Expected product name: "TCI:Website"
- Expected invoice format: `{qboCustomerId}{YY}{MM}{001}`

**Code References:**
- Invoice generation: `src/api/quickbooksApi.js:281-294`
- Migration plan service: `migration-plan.md:536-658`

---

#### TC-Invoice-002: Generate Invoice - Multiple Projects

**Preconditions:**
- Customer has unbilled records for 3 different projects

**Test Steps:**
1. Trigger invoice generation for customer
2. Verify line item grouping

**Expected Results:**
- Invoice created with 3 line items (one per project)
- Each line item shows:
  - Product name: {CUSTOMER_CAPS}:{PROJECT_WORD}
  - Total quantity (sum of records for that project)
  - Unit price (hourly rate)
  - Line total (quantity × unit_price)
- Invoice total = sum of all line totals
- All records marked with same inv_id

**Test Data:**
- Project 1: 10 hours @ $150 = $1,500
- Project 2: 5 hours @ $175 = $875
- Project 3: 8 hours @ $150 = $1,200
- Expected total: $3,575

**Code References:**
- Line item grouping: `api-contracts.md:2088-2099`

---

#### TC-Invoice-003: Generate Invoice - Different Unit Prices

**Preconditions:**
- Same project has records with different hourly rates

**Test Steps:**
1. Create customer_sales records:
   - Record 1: Project A, 5 hrs @ $150
   - Record 2: Project A, 3 hrs @ $175 (different rate)
2. Generate invoice

**Expected Results:**
- Invoice has 2 line items (grouped by product name AND unit price)
- Line 1: {CAPS}:{PROJECT}, 5 hrs @ $150 = $750
- Line 2: {CAPS}:{PROJECT}, 3 hrs @ $175 = $525
- Total: $1,275
- Both line items reference same project but different rates

**Code References:**
- Grouping logic: `src/services/invoiceGenerationService.js:228-260`

---

#### TC-Invoice-004: No Unbilled Records

**Preconditions:**
- Customer exists but has no unbilled records (all inv_id fields populated)

**Test Steps:**
1. Attempt to generate invoice for customer
2. Backend queries customer_sales with `inv_id IS NULL`
3. No records found

**Expected Results:**
- Error message: "No unbilled records found for customer"
- No invoice created in QuickBooks
- No database changes
- User advised to check if all time has been invoiced

**Code References:**
- Unbilled query: `migration-plan.md:592-612`

---

#### TC-Invoice-005: QuickBooks Customer Not Found

**Preconditions:**
- Customer exists in Clarity CRM
- Customer does NOT exist in QuickBooks

**Test Steps:**
1. Attempt to generate invoice
2. Backend searches QuickBooks by customer name
3. No results found

**Expected Results:**
- Error message: "QuickBooks customer not found for '{Customer Name}'. Please create the customer in QuickBooks first or use the Create Customer modal."
- No invoice created
- User guidance provided
- Option to create QB customer via modal (if implemented)

**Code References:**
- Customer search: `migration-plan.md:617-638`

---

#### TC-Invoice-006: Create QuickBooks Customer (If Not Found)

**Preconditions:**
- Customer exists in Clarity but not in QuickBooks
- Create Customer modal implemented

**Test Steps:**
1. Attempt invoice generation
2. System prompts: "Customer not found in QuickBooks"
3. Click "Create Customer" button
4. Modal opens with customer details pre-filled
5. Review/edit details
6. Click "Create in QuickBooks"
7. Customer created successfully
8. Retry invoice generation

**Expected Results:**
- Modal shows customer name, email, address
- User can edit before creating
- Customer created in QuickBooks
- Customer ID returned
- Invoice generation proceeds automatically
- Invoice created successfully

**Code References:**
- Create customer modal: Existing implementation referenced in `migration-plan.md:1858-1879`

---

#### TC-Invoice-007: Fixed-Price Project - No Invoice Generation

**Preconditions:**
- Project has `f_fixedPrice > 0`
- Timer records exist for this project

**Test Steps:**
1. Stop timer on task under fixed-price project
2. System checks project type
3. Skips customer_sales creation

**Expected Results:**
- No customer_sales record created
- Console log: "⊘ Fixed-price project - skipping customer_sales creation"
- Timer record still created in FileMaker (for tracking)
- No invoice line item generated
- Fixed-price revenue recognized separately (not via time billing)

**Code References:**
- Fixed-price detection: `src/services/taskService.js:104-111`
- Business rule: `api-contracts.md:1909-1928`

---

#### TC-Invoice-008: Currency-Specific Tax and Item Codes

**Preconditions:**
- Customers with different currencies exist

**Test Steps:**
1. Generate invoice for CAD customer
2. Generate invoice for USD customer
3. Generate invoice for EUR customer
4. Verify tax codes and item references

**Expected Results:**

| Customer Currency | Tax Code | Item Reference | Item Name |
|-------------------|----------|----------------|-----------|
| CAD | 4 | 3 | Development CAD |
| USD | 3 | 7 | Development USD |
| EUR | 3 | 8 | Development EUR |

- Each invoice uses correct tax and item codes
- Invoice payload includes correct TaxCodeRef
- Line items reference correct ItemRef

**Code References:**
- Tax code logic: `api-contracts.md:2010-2029`
- Item mapping: `api-contracts.md:2033-2050`

---

#### TC-Invoice-009: Document Number Generation

**Preconditions:**
- QuickBooks customer ID: 140
- Current date: June 15, 2025
- Customer has 0 invoices this month

**Test Steps:**
1. Generate first invoice in June 2025
2. Generate second invoice in June 2025
3. Generate first invoice in July 2025

**Expected Results:**
- Invoice 1: `140250601` (customer 140, year 25, month 06, sequence 001)
- Invoice 2: `140250602` (same month, sequence incremented)
- Invoice 3: `140250701` (new month, sequence resets to 001)

**Code References:**
- Document number generation: `api-contracts.md:1977-2006`

---

#### TC-Invoice-010: Due Date Calculation

**Preconditions:**
- Invoice date: January 10, 2026

**Test Steps:**
1. Generate invoice
2. Calculate due date: Jan 10 + 30 days = Feb 9
3. Get end of month: Feb 28, 2026

**Expected Results:**
- Due date: `2026-02-28`
- Follows Net 30 EOM rule

**Test Cases:**
- Jan 31, 2026 → Mar 31, 2026 (Feb 28 + 30 days = Mar 30, EOM = Mar 31)
- Dec 15, 2025 → Feb 28, 2026 (Jan 14 + 30 days = Feb 13, EOM = Feb 28)

**Code References:**
- Due date calculation: `api-contracts.md:2053-2085`

---

#### TC-Invoice-011: Invoice Email Delivery

**Preconditions:**
- QuickBooks customer has email address
- Invoice created successfully

**Test Steps:**
1. Generate invoice
2. Backend sends invoice via QuickBooks email API
3. Verify email sent

**Expected Results:**
- Email sent to customer's primary email address
- EmailStatus field updated in invoice
- Success message includes email confirmation
- Email contains PDF invoice attachment
- User sees "Email sent" status

**Code References:**
- Email sending: `src/api/quickbooksApi.js:548`

---

#### TC-Invoice-012: Invoice Email Skipped (No Email Address)

**Preconditions:**
- QuickBooks customer has NO email address

**Test Steps:**
1. Generate invoice
2. System checks for email address
3. Skips email step

**Expected Results:**
- Invoice created successfully
- No email sent (graceful skip)
- Success message does not mention email
- EmailStatus field remains empty
- No error shown (not a failure condition)

---

### Error Handling Tests

#### TC-Error-001: Network Timeout

**Preconditions:**
- Network connection is slow or unstable

**Test Steps:**
1. Simulate network timeout during invoice creation
2. Backend request times out

**Expected Results:**
- Request fails with timeout error
- User sees error: "Request timed out. Please check your connection and try again."
- No partial invoice created
- No database corruption
- User can retry operation

---

#### TC-Error-002: QuickBooks API Rate Limit Exceeded

**Preconditions:**
- Organization has made 500 requests in past minute

**Test Steps:**
1. Attempt invoice generation
2. QuickBooks returns 429 Too Many Requests

**Expected Results:**
- Backend receives rate limit error
- Error includes `retry_after` value (seconds)
- User sees: "QuickBooks rate limit reached. Retrying in {N} seconds..."
- System waits specified time
- Request retried automatically
- If retry succeeds, user sees success message

**Code References:**
- Rate limit handling: `authorization.md:943-962`

---

#### TC-Error-003: QuickBooks Validation Error

**Preconditions:**
- Invalid data in invoice payload (e.g., missing required field)

**Test Steps:**
1. Attempt to create invoice with invalid data
2. QuickBooks returns validation error

**Expected Results:**
- Backend receives validation error from QuickBooks
- Error includes specific field name and message
- User sees: "{Field} {error message}" (e.g., "Customer display name is required")
- No invoice created
- User can correct data and retry

**Code References:**
- Validation error handling: `authorization.md:966-978`

---

#### TC-Error-004: HMAC Authentication Failure

**Preconditions:**
- HMAC secret key mismatch or signature invalid

**Test Steps:**
1. Attempt API call with invalid HMAC signature
2. Backend validates signature

**Expected Results:**
- Backend rejects request with 401 Unauthorized
- Error message: "Invalid authentication"
- No QuickBooks operation performed
- Security event logged
- User advised to contact support (not a user-fixable issue)

**Code References:**
- HMAC authentication: `src/api/quickbooksApi.js:31-60`
- Security: `authorization.md:746-772`

---

#### TC-Error-005: Organization Access Violation

**Preconditions:**
- Attacker attempts to access another organization's data

**Test Steps:**
1. Manipulate request to use different organization_id
2. Backend validates organization access

**Expected Results:**
- Backend detects mismatch between user's org and requested org
- Request rejected with 403 Forbidden
- Error message: "Organization access denied"
- No data leaked
- Security incident logged
- User session potentially terminated

**Code References:**
- Organization isolation: `authorization.md:777-799`
- Access error handling: `authorization.md:985-999`

---

#### TC-Error-006: Database Connection Failure

**Preconditions:**
- Supabase database unavailable or slow

**Test Steps:**
1. Attempt to fetch unbilled records
2. Database query fails

**Expected Results:**
- Error caught and logged
- User sees: "Failed to fetch unbilled records: {error message}"
- No invoice created
- Operation aborted safely
- User can retry after database recovers

---

#### TC-Error-007: QuickBooks API Fault Response

**Preconditions:**
- QuickBooks API returns Fault object (business logic error)

**Test Steps:**
1. Trigger condition that causes QB Fault (e.g., duplicate invoice)
2. Backend receives Fault response

**Expected Results:**
- Fault structure parsed correctly
- Error message extracted: `{Message}: {Detail}`
- User sees specific QuickBooks error
- No generic "An error occurred" message
- Error logged with full Fault details

**Code References:**
- Fault parsing: `migration-plan.md:802-820`

---

### Retry Logic Tests

#### TC-Retry-001: Retry on Transient Network Error

**Preconditions:**
- Network connection briefly drops during request

**Test Steps:**
1. Simulate transient network error (connection reset)
2. First request fails
3. Retry logic engages

**Expected Results:**
- First attempt fails with network error
- System waits 1 second (exponential backoff: 2^0)
- Retry 1: Attempt 2/3
- If fails, wait 2 seconds (2^1)
- Retry 2: Attempt 3/3
- If all retries fail, show final error to user
- User sees progress: "Retrying... (Attempt 2/3)"

**Code References:**
- Retry with backoff: `migration-plan.md:1826-1838`

---

#### TC-Retry-002: Exponential Backoff Timing

**Preconditions:**
- Request fails repeatedly

**Test Steps:**
1. First attempt fails → wait 1 second (2^0)
2. Second attempt fails → wait 2 seconds (2^1)
3. Third attempt fails → wait 4 seconds (2^2)
4. Fourth attempt fails → give up

**Expected Results:**
- Backoff times calculated correctly
- User sees increasing wait times
- After max retries (3), final error shown
- Total retry time: 1s + 2s + 4s = 7 seconds max

---

#### TC-Retry-003: No Retry on User Errors

**Preconditions:**
- Request fails due to user error (invalid data)

**Test Steps:**
1. Attempt to create invoice with invalid customer ID
2. QuickBooks returns validation error (400 Bad Request)

**Expected Results:**
- No retry attempted (user error, not transient)
- Error shown immediately
- User prompted to correct data
- Retry logic only for 5xx errors and network failures

---

### Edge Case Tests

#### TC-Edge-001: Zero-Hour Invoice (Quantity = 0)

**Preconditions:**
- Customer has records with 0 hours worked (adjustment or error)

**Test Steps:**
1. Attempt to generate invoice with 0-hour records

**Expected Results:**
- Invoice created with 0 quantity line items (if QB allows)
- OR error: "Cannot create invoice with zero-hour line items"
- User advised to review time entries

---

#### TC-Edge-002: Negative Quantity (Time Adjustment)

**Preconditions:**
- Customer_sales record has negative quantity (credit)

**Test Steps:**
1. Attempt to generate invoice with negative quantity

**Expected Results:**
- Invoice created with negative line item (credit memo)
- OR separate credit memo created
- Total amount reflects credit correctly

---

#### TC-Edge-003: Very Large Invoice (100+ Line Items)

**Preconditions:**
- Customer has 100+ unbilled records across many projects

**Test Steps:**
1. Generate invoice for customer
2. Line items grouped correctly
3. QuickBooks accepts large invoice

**Expected Results:**
- All line items included in invoice
- Grouping logic handles large dataset
- Invoice payload size within QB limits
- Total calculated correctly
- Operation completes in <15 seconds

---

#### TC-Edge-004: Concurrent Invoice Generation

**Preconditions:**
- Two users attempt to generate invoice for same customer simultaneously

**Test Steps:**
1. User A clicks "Send to QB" at timestamp T
2. User B clicks "Send to QB" at timestamp T+0.5s
3. Both requests processed

**Expected Results:**
- First request locks records (transaction)
- Second request waits or fails gracefully
- Only ONE invoice created (no duplicates)
- Both users see result (one success, one "already invoiced")

---

#### TC-Edge-005: Special Characters in Customer/Project Names

**Preconditions:**
- Customer name: "O'Brien & Associates (Québec)"
- Project name: "Website—Redesign"

**Test Steps:**
1. Generate invoice
2. Verify product name formatting

**Expected Results:**
- Product name extracts only caps/numbers: "OBA(Q):Website"
- Special characters handled gracefully
- No QuickBooks API errors due to encoding
- Invoice payload properly escaped

---

#### TC-Edge-006: Customer in Supabase but Deleted in QuickBooks

**Preconditions:**
- Customer exists in Clarity CRM
- Customer was deleted in QuickBooks

**Test Steps:**
1. Attempt invoice generation
2. Backend searches for QB customer
3. No active customer found

**Expected Results:**
- Error: "QuickBooks customer not found"
- User prompted to create customer again
- OR system detects inactive status and reactivates
- No invoice created until resolved

---

#### TC-Edge-007: Leap Year and End-of-Month Edge Cases

**Preconditions:**
- Invoice date: February 1, 2024 (leap year)

**Test Steps:**
1. Calculate due date: Feb 1 + 30 = Mar 2
2. Get EOM: Mar 31

**Expected Results:**
- Due date: `2024-03-31`

**Test Case 2:**
- Invoice date: February 1, 2025 (non-leap year)
- Due date: Feb 1 + 30 = Mar 3, EOM = Mar 31
- Expected: `2025-03-31`

---

#### TC-Edge-008: Organization with No QuickBooks Connection

**Preconditions:**
- Organization exists but QuickBooks never connected

**Test Steps:**
1. Attempt any QuickBooks operation

**Expected Results:**
- Error: "QuickBooks not connected for this organization"
- User shown "Connect QuickBooks" button
- Clear instructions on how to connect
- No cryptic errors

---

#### TC-Edge-009: Midnight/Timezone Edge Cases

**Preconditions:**
- User in different timezone than server
- Invoice generated near midnight

**Test Steps:**
1. Generate invoice at 11:59 PM user local time
2. Server processes at 12:01 AM server time (next day)

**Expected Results:**
- Dates consistent throughout system
- Document number uses correct date
- Due date calculated from consistent date
- No off-by-one errors

---

#### TC-Edge-010: QuickBooks Sandbox vs Production

**Preconditions:**
- Testing in QuickBooks sandbox environment

**Test Steps:**
1. Connect to sandbox company
2. Generate invoice
3. Verify sandbox data isolation

**Expected Results:**
- Sandbox data clearly marked
- Production data not affected
- Realm ID correctly identifies sandbox
- No accidental production operations

---

## Performance Testing

### PT-001: Invoice Generation Performance

**Test Objective:** Verify invoice generation completes within acceptable time limits

**Test Steps:**
1. Generate invoices for 10 different customers
2. Measure time from button click to success message
3. Calculate average and 95th percentile

**Success Criteria:**
- Average time: <5 seconds
- 95th percentile: <10 seconds
- No timeouts

**Test Data:**
- Customers with varying record counts (5, 10, 20, 50 records)
- Different project counts (1, 3, 5, 10 projects)

---

### PT-002: Token Refresh Performance

**Test Objective:** Ensure token refresh is transparent and fast

**Test Steps:**
1. Force access token expiration
2. Trigger API call requiring token
3. Measure token refresh time

**Success Criteria:**
- Token refresh: <2 seconds
- Total request time (including refresh): <7 seconds
- No user-visible delay beyond loading indicator

---

### PT-003: Concurrent User Load

**Test Objective:** System handles multiple users generating invoices simultaneously

**Test Steps:**
1. Simulate 10 concurrent users
2. Each user generates invoice
3. Measure completion times and error rates

**Success Criteria:**
- 95%+ success rate
- No deadlocks or race conditions
- Average time increase <50% vs single user
- No duplicate invoices created

---

### PT-004: Large Dataset Handling

**Test Objective:** System handles customers with large number of unbilled records

**Test Steps:**
1. Create customer with 200 unbilled records
2. Generate invoice
3. Measure performance

**Success Criteria:**
- Invoice generation completes
- Time: <15 seconds
- Correct line item grouping
- All records marked as invoiced
- No memory leaks

---

## Security Testing

### ST-001: Organization Isolation

**Test Objective:** Verify absolute isolation between organizations

**Test Steps:**
1. Create 2 test organizations (Org A, Org B)
2. Connect QuickBooks to Org A
3. As user in Org B, attempt to:
   - Access Org A's QB connection
   - Generate invoice using Org A's data
   - View Org A's invoices

**Success Criteria:**
- All cross-org access attempts fail with 403 Forbidden
- No data leaked in error messages
- RLS policies enforce isolation at database level
- Backend validates organization on every request

**Code References:**
- Organization isolation: `authorization.md:777-799`

---

### ST-002: Token Security

**Test Objective:** Ensure OAuth tokens never exposed to frontend

**Test Steps:**
1. Connect QuickBooks
2. Inspect browser localStorage, sessionStorage, cookies
3. Inspect network responses
4. Check JavaScript console logs

**Success Criteria:**
- No OAuth tokens in browser storage
- No tokens in API responses
- No tokens logged to console
- Tokens only in backend database (encrypted)

**Code References:**
- Token security: `authorization.md:713-740`

---

### ST-003: HMAC Authentication

**Test Objective:** Verify HMAC signatures prevent tampering

**Test Steps:**
1. Capture valid HMAC-signed request
2. Modify payload
3. Replay request with original signature
4. Attempt timestamp manipulation

**Success Criteria:**
- Modified payload rejected (signature mismatch)
- Old timestamp rejected (>5 minutes)
- Constant-time comparison prevents timing attacks
- All invalid requests return 401 Unauthorized

**Code References:**
- HMAC authentication: `authorization.md:88-151`

---

### ST-004: CSRF Protection

**Test Objective:** Verify OAuth flow protected against CSRF

**Test Steps:**
1. Initiate OAuth flow, capture state parameter
2. Attempt callback with different state
3. Attempt callback without state

**Success Criteria:**
- Invalid state rejected
- Missing state rejected
- Error message: "CSRF validation failed"
- No tokens granted

**Code References:**
- CSRF protection: `authorization.md:804-816`

---

### ST-005: SQL Injection Prevention

**Test Objective:** Verify all database queries safe from SQL injection

**Test Steps:**
1. Attempt SQL injection in customer name: `'; DROP TABLE customers; --`
2. Attempt injection in project name
3. Test other user inputs

**Success Criteria:**
- All queries use parameterized statements
- No SQL executed from user input
- Input sanitized/escaped correctly
- No database errors

**Code References:**
- SQL injection prevention: `authorization.md:836-839`

---

### ST-006: XSS Prevention

**Test Objective:** Verify QuickBooks data cannot inject scripts

**Test Steps:**
1. Create QB customer with name: `<script>alert('XSS')</script>`
2. Display customer in UI
3. Generate invoice

**Success Criteria:**
- Script tags rendered as text (React auto-escaping)
- No JavaScript execution
- Invoice created without errors
- Data properly sanitized in QB API calls

**Code References:**
- XSS prevention: `authorization.md:821-834`

---

## Integration Testing

### IT-001: Timer Stop → Customer Sales → Invoice Flow

**Test Objective:** Verify end-to-end integration from timer to invoice

**Test Steps:**
1. Start timer on task
2. Work for 10 minutes
3. Stop timer
4. Verify customer_sales record created
5. Generate invoice from record
6. Verify invoice in QuickBooks

**Success Criteria:**
- Timer stop creates customer_sales record
- Record has correct: quantity (0.17 hrs), unit_price, total_price, inv_id=NULL
- Invoice generation finds record
- Invoice created successfully
- Record updated with inv_id
- End-to-end time: <2 minutes

---

### IT-002: Supabase RLS Integration

**Test Objective:** Verify RLS policies enforced correctly

**Test Steps:**
1. User from Org A queries customer_sales
2. Verify only Org A records returned
3. Attempt to query with Org B organization_id
4. Verify access denied

**Success Criteria:**
- RLS policies filter by organization_id from JWT
- Cross-org queries return empty results (not error)
- No org isolation bypass possible
- Service role queries respect organization context

---

### IT-003: Backend API Error Propagation

**Test Objective:** Ensure backend errors surfaced correctly to frontend

**Test Steps:**
1. Trigger various backend errors:
   - QuickBooks API error
   - Database error
   - Validation error
2. Verify error messages displayed to user

**Success Criteria:**
- All errors caught and handled
- Specific error messages shown (not generic)
- Error codes preserved from QB to frontend
- Stack traces not exposed to user
- All errors logged on backend

---

## User Acceptance Testing

### UAT-001: Invoice Generation Workflow

**Test Objective:** Real user completes invoice generation successfully

**Test Participant:** Marcus (primary user)

**Test Steps:**
1. User logs into Clarity CRM
2. Navigates to Financial Activity
3. Filters for customer with unbilled time
4. Clicks "Send to QuickBooks"
5. Reviews success message
6. Checks QuickBooks for invoice
7. Verifies invoice details correct

**Success Criteria:**
- User completes workflow without assistance
- User understands feedback messages
- User confirms invoice correct in QuickBooks
- User satisfaction: Positive feedback

---

### UAT-002: Error Recovery

**Test Objective:** User understands and recovers from errors

**Test Participant:** Marcus

**Test Steps:**
1. Trigger error: Customer not found in QuickBooks
2. User reads error message
3. User follows guidance to create QB customer
4. User retries invoice generation

**Success Criteria:**
- User understands error message
- User knows what action to take
- User successfully resolves issue
- User does not need support contact

---

### UAT-003: QuickBooks Connection Setup

**Test Objective:** User connects QuickBooks successfully

**Test Participant:** New organization user

**Test Steps:**
1. User clicks "Connect QuickBooks"
2. User completes OAuth flow
3. User verifies connection active

**Success Criteria:**
- User understands OAuth process
- User completes authorization without confusion
- User sees clear success confirmation
- User can immediately generate invoices

---

## Test Data Requirements

### Test Organizations

**Organization A (Primary Test Org):**
- Name: "Clarity Integration Testing"
- QuickBooks: Sandbox Company
- Users: Marcus, Test User 1
- Customers: 10 test customers
- Projects: 20 test projects
- Unbilled records: 50+ records

**Organization B (Isolation Testing):**
- Name: "Clarity Isolation Test"
- QuickBooks: Different sandbox company
- Users: Test User 2
- Customers: 5 test customers
- Purpose: Cross-org isolation testing

---

### Test Customers

**Customer 1: "Test Customer Inc." (Happy Path)**
- QuickBooks: Exists in sandbox
- Currency: CAD
- Projects: 3 projects
- Unbilled records: 15 records
- Email: test@example.com

**Customer 2: "No QB Customer Corp." (Error Testing)**
- QuickBooks: Does NOT exist
- Currency: USD
- Purpose: Test "customer not found" flow

**Customer 3: "Fixed Price Co." (Edge Case)**
- QuickBooks: Exists
- Currency: CAD
- Projects: 1 fixed-price project
- Unbilled records: 0 (all fixed-price)

**Customer 4: "Multi-Currency Ltd." (Currency Testing)**
- QuickBooks: Exists
- Currency: EUR
- Purpose: Test EUR tax/item codes

---

### Test Projects

**Project 1: "Website Redesign" (Hourly)**
- Customer: Test Customer Inc.
- Type: Hourly
- Rate: $150/hr
- Unbilled hours: 10 hours

**Project 2: "Mobile App" (Fixed-Price)**
- Customer: Fixed Price Co.
- Type: Fixed-price
- f_fixedPrice: $10,000
- Unbilled hours: N/A

**Project 3: "Consulting" (Staff Rate)**
- Customer: Test Customer Inc.
- Type: Hourly
- Rate: Staff-level rate ($175/hr)

---

## Test Environment Setup

### Development Environment

**Local Setup:**
```bash
# Frontend
npm run dev  # Vite server on port 1235

# Environment variables
VITE_API_URL=https://api.claritybusinesssolutions.ca
VITE_SECRET_KEY={dev_hmac_secret}
VITE_CLARITY_INTEGRATION_ORG_ID={test_org_uuid}
VITE_SUPABASE_URL=https://supabase.claritybusinesssolutions.ca
VITE_SUPABASE_ANON_KEY={dev_anon_key}
```

**QuickBooks Setup:**
- Use QuickBooks Sandbox environment
- Create test company: "Clarity CRM Dev"
- Pre-populate with test customers

---

### Staging Environment

**Staging Server:**
- URL: `https://staging.claritybusinesssolutions.ca`
- QuickBooks: Sandbox company
- Supabase: Staging database
- Isolated from production data

**Test Data:**
- Clone production structure
- Use synthetic test data
- No real customer information

---

### Production Environment (Phased Rollout)

**Phase 1: Single Organization (Beta)**
- Enable for Clarity Business Solutions org only
- Monitor closely for issues
- Duration: 7 days

**Phase 2: Limited Rollout**
- Enable for 3-5 friendly customers
- Collect feedback
- Duration: 14 days

**Phase 3: Full Rollout**
- Enable for all organizations
- Monitor performance metrics
- Rollback plan ready

---

## Rollback Testing

### RT-001: Immediate Rollback

**Test Objective:** Verify rollback within 24 hours of deployment

**Test Steps:**
1. Deploy migration to production
2. Identify critical issue
3. Execute rollback:
   ```bash
   git checkout <previous-commit>
   npm run build
   npm run deploy-to-fm
   ```
4. Verify FileMaker integration restored

**Success Criteria:**
- Rollback completes in <30 minutes
- FileMaker initializeQuickBooks works
- No data loss
- All existing invoices intact
- Users can continue work

**Code References:**
- Rollback procedure: `migration-plan.md:1343-1375`

---

### RT-002: Partial Rollback

**Test Objective:** Rollback single component while keeping others migrated

**Test Steps:**
1. Identify problematic component (e.g., FinancialActivity.jsx)
2. Revert only that file:
   ```bash
   git checkout <previous-commit> -- src/components/financial/FinancialActivity.jsx
   ```
3. Test and redeploy

**Success Criteria:**
- Single file reverted successfully
- Other migrated components still work
- No conflicts or errors
- Gradual migration possible

---

### RT-003: Data Recovery

**Test Objective:** Recover from incorrect invoice ID updates

**Test Steps:**
1. Simulate: Incorrect inv_id written to customer_sales
2. Execute recovery:
   ```sql
   UPDATE customer_sales
   SET inv_id = NULL
   WHERE inv_id = '{INCORRECT_ID}';
   ```
3. Re-generate invoice

**Success Criteria:**
- Invalid invoice IDs cleared
- Records marked unbilled again
- Invoice re-generation succeeds
- No data loss

---

## Sign-Off Criteria

### Development Sign-Off

**Checklist:**
- [ ] All code changes implemented
- [ ] Build succeeds without errors
- [ ] No console errors during manual testing
- [ ] Deprecated functions clearly marked
- [ ] No TODO/FIXME comments in completed code
- [ ] Code follows project patterns
- [ ] Documentation updated

**Sign-Off:** Technical Lead

---

### Testing Sign-Off

**Checklist:**
- [ ] All test cases executed
- [ ] 95%+ test pass rate
- [ ] All critical bugs resolved
- [ ] Performance targets met
- [ ] Security tests passed
- [ ] Integration tests passed

**Sign-Off:** QA Lead

---

### UAT Sign-Off

**Checklist:**
- [ ] All UAT scenarios completed
- [ ] User feedback positive (≥90% satisfaction)
- [ ] Users can complete workflows without assistance
- [ ] Error messages clear and actionable
- [ ] No critical usability issues

**Sign-Off:** Product Owner / Marcus

---

### Production Readiness Sign-Off

**Checklist:**
- [ ] All acceptance criteria met
- [ ] Rollback procedure tested
- [ ] Monitoring and alerting configured
- [ ] Support documentation updated
- [ ] Team trained on new system
- [ ] Phased rollout plan approved

**Sign-Off:** Project Manager

---

## Summary

This acceptance criteria and test plan document provides comprehensive coverage for the QuickBooks migration from FileMaker to backend API architecture.

**Test Coverage:**
- ✅ 100+ test cases across all categories
- ✅ OAuth flow and token lifecycle
- ✅ Invoice generation (happy path and edge cases)
- ✅ Error handling and retry logic
- ✅ Performance and security testing
- ✅ Integration and user acceptance testing

**Key Testing Priorities:**
1. **Zero Data Loss** - Validate no customer sales records lost
2. **Organization Isolation** - Verify multi-tenant security
3. **Token Security** - Ensure OAuth tokens never exposed
4. **Error Handling** - All errors surfaced and actionable
5. **Performance** - Invoice generation <10 seconds
6. **Rollback** - Can revert safely if issues found

**Next Steps:**
1. Review and approve acceptance criteria
2. Set up test environments
3. Create test data
4. Execute test plan systematically
5. Document results and issues
6. Obtain sign-offs at each gate
7. Proceed with phased production deployment

---

**Document Status:** ✅ Complete
**Last Updated:** 2026-01-11
**Owner:** Frontend Team + QA Team
**Reviewers:** Marcus Swift, Technical Lead, Product Owner
