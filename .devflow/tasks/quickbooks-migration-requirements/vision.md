# QuickBooks Migration Requirements - Feature Vision

## Overview

Migrate QuickBooks integration from FileMaker script execution to direct backend/Supabase implementation. This migration eliminates the FileMaker dependency for QuickBooks operations, enabling the application to function as a standalone web app with full QuickBooks integration capabilities.

## Goals

1. **Remove FileMaker Dependency**: Eliminate the `initializeQuickBooks()` function's dependency on FileMaker script execution
2. **Document Current Flows**: Comprehensively document all QuickBooks operations currently triggered via FileMaker
3. **Define Backend Requirements**: Specify backend API contracts for QuickBooks initialization, synchronization, and testing
4. **Ensure Feature Parity**: Maintain all existing QuickBooks functionality during migration
5. **Improve Error Handling**: Implement robust error handling, retry logic, and user feedback

## Success Criteria

- Complete documentation of current QuickBooks flows in `requirements/quickbooks/`
- All FileMaker QuickBooks script calls identified and documented
- Backend API contracts defined for QB operations
- OAuth flow requirements documented
- Token management strategy specified
- Organization scoping requirements defined
- Migration plan with rollback procedures
- Acceptance criteria and test plan covering edge cases

## Technical Approach

### Current Implementation Analysis

**FileMaker Script Execution** (src/api/fileMaker.js:447-501)
- `initializeQuickBooks(params)` function calls FileMaker script "Initialize QB via JS"
- Accepts customer ID and optional record IDs grouped by project
- Fire-and-forget operation with no response handling
- No error recovery or retry logic

**Existing Backend Integration** (src/api/quickbooksApi.js)
- Comprehensive QuickBooks API client already exists
- HMAC-SHA256 authentication implemented
- OAuth flow support (authorize, callback, refresh)
- Customer, invoice, bill operations
- Webhook support

**UI Integration** (src/components/financial/CustomerSalesTable.jsx)
- Uses QuickBooks API for customer operations
- Invoice generation and email sending
- Customer search and creation

### Migration Strategy

1. **Phase 1: Requirements Documentation**
   - Document all current QuickBooks operations
   - Map FileMaker script behavior to backend requirements
   - Define API contracts for frontend consumption

2. **Phase 2: Backend Implementation** (Backend Team)
   - Implement QB initialization endpoint
   - Token storage and refresh mechanisms
   - Organization-scoped QB operations
   - Error handling and retry logic

3. **Phase 3: Frontend Migration** (Future)
   - Replace FileMaker script calls with backend API calls
   - Update error handling
   - Add user feedback for async operations

## Files to Review/Modify

### Documentation (Phase 1 - This Feature)
- `requirements/quickbooks/README.md` - Overview and current flows
- `requirements/quickbooks/current-implementation.md` - Detailed implementation analysis
- `requirements/quickbooks/data-model-mapping.md` - Token storage, config tables
- `requirements/quickbooks/api-contracts.md` - Backend endpoint specifications
- `requirements/quickbooks/authorization.md` - OAuth, scoping, security
- `requirements/quickbooks/migration-plan.md` - Step-by-step migration approach
- `requirements/quickbooks/acceptance-criteria.md` - Test cases and validation

### Code Files (Referenced in Documentation)
- `src/api/fileMaker.js` - Current initializeQuickBooks implementation
- `src/api/quickbooksApi.js` - Existing QB API client
- `src/components/financial/CustomerSalesTable.jsx` - UI integration
- `src/services/financialSyncService.js` - Related financial operations

## Dependencies

### Internal
- Financial records migration (INS0007) - Related to QB invoicing
- Backend Change Protocol - Must follow backend change request process

### External
- Backend API team - Must implement QB initialization endpoint
- QuickBooks OAuth credentials - Already configured in environment
- Supabase - For token storage and organization scoping

## Risks and Mitigations

### Risk: OAuth Token Expiration
**Mitigation**: Implement automatic token refresh with user notification on failure

### Risk: Organization Scoping Complexity
**Mitigation**: Document clear requirements for multi-org QB integration

### Risk: Breaking Existing Flows
**Mitigation**: Comprehensive documentation of current behavior before changes

### Risk: Async Operation Feedback
**Mitigation**: Define clear user feedback patterns for QB operations

## Related Documentation

- FILEMAKER_TO_SUPABASE_MIGRATION_PLAN.md - Section 2.7 "Update QuickBooks Integration"
- CLAUDE.md - QuickBooks Integration section
- Backend Change Protocol - Required for backend modifications
