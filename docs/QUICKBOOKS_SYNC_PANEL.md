# QuickBooks Sync Panel Documentation

## Overview

The `QuickBooksSyncPanel` component provides a user interface for synchronizing invoices from QuickBooks to the local database. It's part of the Financial Management system and accessible via the "Invoice Sync" tab.

**Location**: `src/components/financial/QuickBooksSyncPanel.jsx`

## Features

### Core Functionality
- **Manual Sync Trigger**: Users can initiate invoice synchronization via the "Sync Now" button
- **Date Range Selection**: Users can specify start and end dates for the sync operation
- **Quick Date Presets**: Buttons for "Current Month" and "Previous Month" for convenience
- **Full Sync Option**: Checkbox to enable full sync (process all invoices regardless of previous sync state)

### Status Management
- **Sync States**: Tracks idle, syncing, success, and error states
- **Visual Status Badge**: Color-coded badge showing current sync status
- **Progress Indicator**: Animated progress bar during sync operations
- **Last Sync Timestamp**: Displays when the last successful sync occurred

### Error Handling
- **Error Display**: Shows user-friendly error messages when sync fails
- **Retry Button**: Allows users to retry failed syncs
- **Graceful Degradation**: Handles API failures without crashing the UI

### Sync Summary
- **Success Metrics**: Displays count of total synced, new, and updated invoices
- **Persistent Storage**: Saves last sync results to localStorage for persistence across sessions

## Component Props

```javascript
QuickBooksSyncPanel.propTypes = {
  darkMode: PropTypes.bool,      // Whether dark mode is enabled
  onSyncComplete: PropTypes.func  // Optional callback when sync completes successfully
};
```

## Usage

### Integration in FinancialActivity

```javascript
import QuickBooksSyncPanel from './QuickBooksSyncPanel';

// In the tab content:
{activeTab === 'invoice-sync' && (
  <QuickBooksSyncPanel
    darkMode={darkMode}
    onSyncComplete={fetchData}
  />
)}
```

### API Integration

The component uses the `syncInvoices()` function from `src/api/quickbooksApi.js`:

```javascript
const response = await syncInvoices({
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  full_sync: false
});
```

## State Management

### Local State
- `isSyncing`: Boolean flag for sync operation in progress
- `syncStatus`: Current status ('idle', 'syncing', 'success', 'error')
- `syncError`: Error message if sync fails
- `lastSyncResult`: Result object from last successful sync
- `lastSyncTimestamp`: ISO timestamp of last sync
- `dateRange`: Object with startDate and endDate
- `fullSync`: Boolean for full sync option

### Persistent State
Last sync information is stored in localStorage with key `qb_last_sync`:

```javascript
{
  timestamp: "2024-01-15T10:30:00.000Z",
  result: {
    invoices_synced: 45,
    new_invoices: 12,
    updated_invoices: 33
  }
}
```

## User Interface

### Status Badge Colors
- **Idle**: Gray (neutral state)
- **Syncing**: Blue (in progress)
- **Success**: Green (completed successfully)
- **Error**: Red (failed)

### Dark Mode Support
The component fully supports dark mode with appropriate color schemes:
- Light mode: White backgrounds, gray borders, colored accents
- Dark mode: Dark gray backgrounds, lighter borders, vibrant accents

### Responsive Design
- Mobile-friendly grid layout for date inputs
- Flexible button sizing
- Scrollable content areas

## Error Handling

### Error Display
Errors are shown in a prominent banner with:
- Error title ("Sync Error")
- Detailed error message
- Retry button for recovery

### Error Sources
- API request failures (network, server errors)
- Authentication errors (HMAC, JWT issues)
- Backend validation errors (invalid date ranges, role permissions)

## Sync Flow

1. **User Action**: User selects date range and clicks "Sync Now"
2. **Validation**: Component validates date range is present
3. **API Call**: Calls `syncInvoices()` with date range and options
4. **Progress Display**: Shows syncing status and progress indicator
5. **Result Handling**:
   - **Success**: Display summary, save to localStorage, call onSyncComplete
   - **Error**: Display error message with retry option
6. **State Reset**: User can initiate new sync or retry failed sync

## Integration Points

### Backend API
- **Endpoint**: `POST /api/quickbooks/sync-invoices`
- **Authentication**: JWT-based (requires user roles: admin/billing/owner)
- **Request Format**:
  ```javascript
  {
    start_date: "YYYY-MM-DD",
    end_date: "YYYY-MM-DD",
    full_sync: boolean
  }
  ```
- **Response Format**:
  ```javascript
  {
    success: true,
    data: {
      invoices_synced: number,
      new_invoices: number,
      updated_invoices: number
    }
  }
  ```

### Parent Component
- **FinancialActivity**: Hosts the panel in the "Invoice Sync" tab
- **Callback**: `onSyncComplete` called after successful sync to refresh financial data

## Testing Considerations

### Manual Testing
1. Navigate to Financial Management → Invoice Sync tab
2. Verify default date range is current month
3. Test "Current Month" and "Previous Month" quick select buttons
4. Test custom date range selection
5. Test full sync checkbox
6. Test "Sync Now" button (requires QuickBooks connection)
7. Verify status badge changes during sync
8. Verify success summary displays correct metrics
9. Test error handling with invalid credentials
10. Test retry button after error
11. Verify last sync timestamp persists across page reloads

### Edge Cases
- Empty date range (should show validation error)
- Future dates (backend validation)
- No QuickBooks connection (should show error)
- Network failure during sync (should show error with retry)
- Concurrent sync requests (prevented by isSyncing flag)

## Known Limitations

1. **Role-Based Access**: Sync endpoint requires user roles (admin/billing/owner) which are only available with JWT authentication. HMAC authentication will result in 403 errors.

2. **No Real-Time Progress**: The sync operation shows a generic progress indicator but doesn't provide granular progress updates (e.g., "50 of 100 invoices synced").

3. **No Automatic Sync**: Users must manually trigger syncs. There's no scheduled/automatic sync functionality.

4. **localStorage Limitation**: Last sync info is stored in browser localStorage, so it won't sync across devices or browsers.

## Future Enhancements

- Add automatic sync scheduling (daily, weekly)
- Add granular progress updates during sync
- Add sync history log (not just last sync)
- Add filtering by customer/project
- Add export of sync results
- Add conflict resolution UI for manual review
- Add sync preview before execution

## Related Documentation

- **API Documentation**: `docs/QUICKBOOKS_BACKEND_API_TESTS.md`
- **Connection Management**: `docs/QUICKBOOKS_CONNECTION_PANEL.md`
- **Backend Integration Guide**: `BACKEND_INTEGRATION_GUIDE.md`
- **QuickBooks Implementation Status**: `QUICKBOOKS_IMPLEMENTATION_STATUS.md`
