# QuickBooks Backend Integration Feature

## Overview

Integrate the Clarity CRM frontend with the new backend QuickBooks API infrastructure, replacing FileMaker-based invoice generation with direct backend integration for connection management, synchronization, and invoice operations.

## Goals

1. **Replace FileMaker Dependency**: Eliminate `initializeQuickBooks()` FileMaker script calls with direct backend API integration
2. **Enable Connection Management**: Allow users to connect/disconnect QuickBooks via OAuth flow through backend
3. **Implement Sync Operations**: Trigger and monitor financial record synchronization with QuickBooks
4. **Display Status/Errors**: Show real-time connection status, sync progress, and error details in UI
5. **Configure Account Mappings**: Support organization-specific QuickBooks item/tax code configuration

## Success Criteria

- ✅ User can connect to QuickBooks via backend OAuth flow (no FileMaker dependency)
- ✅ User can trigger invoice generation via backend API
- ✅ User can see sync status (in-progress, success, errors) in real-time
- ✅ Admin can configure QuickBooks account mappings (tax codes, item IDs)
- ✅ All QuickBooks operations work in standalone web app (no FileMaker required)
- ✅ Tests pass for connection, sync, invoice operations

## Technical Approach

### Backend Verification (Phase 1)
1. Verify backend schema tables exist (`quickbooks_tokens`, `organization_quickbooks_config`)
2. Verify new endpoints are deployed (`/quickbooks/status`, `/quickbooks/invoices/from-records`, `/quickbooks/unbilled-records`)
3. Test backend OAuth flow and token storage
4. Validate HMAC authentication works for all endpoints

### Frontend Integration (Phase 2)
1. Update API client to use new backend endpoints:
   - Connection status: `/quickbooks/status`
   - OAuth flow: `/quickbooks/authorize`, `/quickbooks/oauth/callback`
   - Invoice from records: `/quickbooks/invoices/from-records`
   - Unbilled records: `/quickbooks/unbilled-records`
   - Sync invoices: `/quickbooks/sync-invoices`

2. Create UI components:
   - QuickBooksConnectionPanel (connect/disconnect, show status)
   - QuickBooksSyncPanel (trigger sync, show progress)
   - QuickBooksConfigPanel (admin-only account mapping config)
   - Error display components for QuickBooks API failures

3. Update existing components:
   - CustomerSalesTable: Use backend endpoints instead of FileMaker
   - FinancialActivity: Add QuickBooks connection status indicator
   - FinancialSyncPanel: Add QuickBooks sync integration

### Data Migration (Phase 3)
1. Verify customer_sales table has new columns (`is_billed`, `quickbooks_invoice_id`)
2. Migrate FileMaker `f_billed` status to Supabase `is_billed`
3. Test unbilled records queries with new schema

### Testing (Phase 4)
1. Integration tests for OAuth flow
2. Integration tests for invoice creation from financial records
3. Integration tests for sync operations
4. Unit tests for UI components
5. E2E tests for complete workflows

## Files to Modify

### API Layer
- `src/api/quickbooksApi.js` - Add new endpoint functions (status, unbilled-records, invoices/from-records)
- `src/api/financialRecords.js` - Update to use backend endpoints instead of FileMaker

### Services
- `src/services/financialSyncService.js` - Integrate with QuickBooks sync endpoints
- `src/services/invoiceGenerationService.js` - Use backend invoice creation endpoint

### UI Components (New)
- `src/components/financial/QuickBooksConnectionPanel.jsx` - Connection management UI
- `src/components/financial/QuickBooksSyncPanel.jsx` - Sync trigger and status UI
- `src/components/financial/QuickBooksConfigPanel.jsx` - Admin config UI
- `src/components/financial/QuickBooksErrorDisplay.jsx` - Error handling UI

### UI Components (Update)
- `src/components/financial/CustomerSalesTable.jsx` - Use backend endpoints
- `src/components/financial/FinancialActivity.jsx` - Add connection status
- `src/components/financial/FinancialSyncPanel.jsx` - Add QB sync integration

### Hooks (New)
- `src/hooks/useQuickBooksConnection.js` - Hook for connection status
- `src/hooks/useQuickBooksSync.js` - Hook for sync operations

### Tests
- `src/api/__tests__/quickbooksApi.test.js` - API client tests
- `src/components/financial/__tests__/QuickBooksConnectionPanel.test.jsx` - Component tests
- `src/services/__tests__/financialSyncService.test.js` - Service tests

## Dependencies

### Backend Requirements
- ✅ QuickBooks API endpoints deployed (verified)
- ⚠️ Database schema deployed (`quickbooks_tokens`, `organization_quickbooks_config`) - needs verification
- ⚠️ `customer_sales` table updated with new columns - needs verification

### Frontend Requirements
- Environment variables configured:
  - `VITE_API_URL` - Backend API URL
  - `VITE_SECRET_KEY` - HMAC signing secret
  - `VITE_CLARITY_INTEGRATION_ORG_ID` - Organization ID

### External Services
- QuickBooks Online OAuth credentials configured on backend
- HMAC authentication working between frontend and backend

## Risk Mitigation

### Risk: Backend schema not deployed
- **Mitigation**: Verify schema existence before implementing frontend code
- **Fallback**: Document schema requirements, wait for backend team deployment

### Risk: FileMaker cutover breaks existing workflows
- **Mitigation**: Implement feature flags to toggle between FileMaker and backend
- **Fallback**: Keep FileMaker path functional during transition period

### Risk: QuickBooks API rate limits
- **Mitigation**: Implement rate limiting in backend, show user-friendly errors
- **Fallback**: Queue operations, retry with exponential backoff

### Risk: Token refresh failures
- **Mitigation**: Backend handles token refresh automatically, clear error messages
- **Fallback**: Force OAuth re-authentication if refresh fails

## Rollout Plan

### Phase 1: Verification (1 day)
- Verify backend schema deployed
- Verify new endpoints working
- Test OAuth flow end-to-end
- Document any gaps

### Phase 2: Core Integration (2-3 days)
- Implement API client updates
- Create connection management UI
- Implement invoice creation from records
- Basic error handling

### Phase 3: Sync and Status (2 days)
- Implement sync operations
- Add status indicators
- Improve error display
- Add loading states

### Phase 4: Configuration (1 day)
- Admin config panel
- Account mapping UI
- Validation and testing

### Phase 5: Testing and Refinement (2 days)
- Integration tests
- E2E tests
- Bug fixes
- Documentation

### Phase 6: Deployment (1 day)
- Deploy to staging
- User acceptance testing
- Deploy to production
- Monitor and support

## Monitoring and Success Metrics

### Key Metrics
- **Connection Success Rate**: % of OAuth connections that complete successfully
- **Invoice Creation Success Rate**: % of invoice operations that succeed
- **Sync Completion Time**: Average time for financial record sync
- **Error Rate**: % of QuickBooks operations that fail
- **Token Refresh Success**: % of automatic token refreshes that succeed

### Alerts
- OAuth connection failures
- Invoice creation failures (>5% error rate)
- Token refresh failures
- Sync operations taking >60 seconds

### Dashboards
- QuickBooks operation health dashboard
- Connection status per organization
- Invoice generation metrics
- Error logs and patterns

## Related Documentation

- Backend Change Request: `BACKEND_CHANGE_REQUEST_001_QUICKBOOKS_MIGRATION.md`
- API Contracts: `.devflow/tasks/quickbooks-migration-requirements/api-contracts.md`
- Current Implementation: `requirements/quickbooks/current-implementation.md`
- Data Model Mapping: `requirements/quickbooks/data-model-mapping.md`
- Authorization Spec: `requirements/quickbooks/authorization.md`
