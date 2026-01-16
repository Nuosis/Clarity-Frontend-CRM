# QuickBooks Connection Panel Documentation

## Overview

The `QuickBooksConnectionPanel` component provides a user interface for managing the QuickBooks Online connection for an organization. It displays connection status, handles OAuth authentication flow, and shows company information when connected.

## Location

`src/components/financial/QuickBooksConnectionPanel.jsx`

## Features

### 1. Connection Status Display
- Shows visual indicator (✓ Connected / ○ Not Connected)
- Color-coded status badges (green for connected, gray for disconnected)
- Automatic status refresh on mount and after OAuth callback

### 2. Token Expiration Monitoring
- Displays token expiration date and time
- Color-coded expiration status badges:
  - **Green**: Valid (expires in more than 7 days)
  - **Yellow**: Expiring soon (expires within 7 days)
  - **Red**: Expired
- Human-readable expiration countdown (e.g., "Expires in 15 days")

### 3. QuickBooks Company Information
- Displays QuickBooks company name when connected
- Shows QuickBooks Realm ID (Company ID)
- Automatically fetches company info after successful connection

### 4. OAuth Connection Flow
- "Connect to QuickBooks" button initiates OAuth flow
- Redirects to QuickBooks authorization page
- Handles OAuth callback and URL cleanup automatically
- "Reconnect" option available when already connected (to refresh tokens)

### 5. Error Handling
- User-friendly error messages for connection failures
- Graceful handling of missing organization ID
- Error state display with retry capability

### 6. UI/UX Features
- Loading states during API calls
- Refresh button to manually check connection status
- Responsive design following project design system
- Full dark mode support
- Consistent styling with Tailwind CSS

## Usage

### Basic Integration

```jsx
import QuickBooksConnectionPanel from './components/financial/QuickBooksConnectionPanel';

function FinancialSettings({ darkMode }) {
  return (
    <div>
      <QuickBooksConnectionPanel darkMode={darkMode} />
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `darkMode` | `boolean` | `false` | Enable dark mode styling |

## Dependencies

### API Functions
- `getQuickBooksStatus(organizationId)` - Fetch connection status
- `getQBOAuthorizationUrl()` - Get OAuth authorization URL
- `getQBOCompanyInfo()` - Fetch QuickBooks company information

### Context
- `useAppState()` - Access user context for organization ID

### Required User Data
The component requires `user.supabaseOrgID` from AppStateContext to function. If this is not available, an error message will be displayed.

## Component States

### Loading State
Displayed when initially checking connection status or during data fetching.

### Connected State
Displayed when QuickBooks is successfully connected. Shows:
- Connection status badge
- Token expiration status
- Company ID (Realm ID)
- Company name
- Token expiration date
- "Reconnect" button

### Disconnected State
Displayed when QuickBooks is not connected. Shows:
- Disconnected status badge
- Information about what connecting enables
- "Connect to QuickBooks" button

### Error State
Displayed when an error occurs. Shows:
- Error message
- Ability to retry via refresh button

## OAuth Flow

### Step 1: Initiate Connection
1. User clicks "Connect to QuickBooks" button
2. Component calls `getQBOAuthorizationUrl()`
3. Backend returns OAuth authorization URL
4. User is redirected to QuickBooks login page

### Step 2: Authorization
1. User logs into QuickBooks
2. User authorizes the application
3. QuickBooks redirects back to app with `code` and `state` parameters

### Step 3: Token Exchange (Backend)
1. Backend receives OAuth callback
2. Backend exchanges authorization code for access/refresh tokens
3. Backend stores tokens in `integration_tokens` table

### Step 4: Status Update (Frontend)
1. Component detects callback parameters in URL
2. Component cleans up URL (removes query parameters)
3. Component refreshes connection status
4. Connection status shows as connected with company info

## Backend Integration

### Backend Endpoints Used

#### GET /quickbooks/status
- **Authentication**: HMAC-SHA256
- **Query Parameters**: `organization_id` (required)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "connected": true,
      "realm_id": "123456789",
      "expires_at": "2026-02-15T12:00:00Z",
      "is_expired": false
    }
  }
  ```

#### GET /quickbooks/authorize
- **Authentication**: HMAC-SHA256
- **Response**:
  ```json
  {
    "authorization_url": "https://appcenter.intuit.com/connect/oauth2?...",
    "state": "random-state-string"
  }
  ```

#### GET /quickbooks/company-info
- **Authentication**: HMAC-SHA256 (requires active connection)
- **Response**:
  ```json
  {
    "CompanyInfo": {
      "CompanyName": "My Company Inc",
      "Id": "123456789",
      ...
    }
  }
  ```

## Integration with FinancialActivity

The component is integrated into the FinancialActivity component as a separate tab:

```jsx
// In FinancialActivity.jsx
import QuickBooksConnectionPanel from './QuickBooksConnectionPanel';

const tabs = [
  { id: 'activity', label: 'Financial Activity' },
  { id: 'sync', label: 'Data Synchronization' },
  { id: 'quickbooks', label: 'QuickBooks Connection' }
];

// Tab content
{activeTab === 'quickbooks' && (
  <QuickBooksConnectionPanel darkMode={darkMode} />
)}
```

## Security Considerations

1. **No Frontend Token Storage**: OAuth tokens are never exposed to the frontend. All token management is handled by the backend.

2. **Organization Scoping**: Connection status is always scoped to the user's organization via the `supabaseOrgID`.

3. **HMAC Authentication**: All API calls use HMAC-SHA256 authentication to prevent unauthorized access.

4. **URL Cleanup**: OAuth callback parameters are removed from the URL after processing to prevent sharing sensitive authorization codes.

5. **Error Messages**: Error messages are user-friendly and don't expose sensitive system details.

## Future Enhancements

### Disconnect Functionality
Currently not implemented as the backend does not expose a disconnect/revoke endpoint. Users can reconnect to refresh tokens, but cannot explicitly disconnect.

**Potential Implementation**:
- Add backend endpoint: `DELETE /quickbooks/connection`
- Add "Disconnect" button in connected state
- Confirm dialog before disconnect
- Clear tokens from backend database

### Connection History
Track and display connection/disconnection events:
- Last connected date
- Last token refresh date
- Connection uptime

### Advanced Company Info
Display more QuickBooks company details:
- Currency
- Country
- Fiscal year details
- Subscription level

### Automatic Token Refresh
Background token refresh before expiration:
- Monitor expiration date
- Auto-refresh when < 7 days remaining
- Notify user of refresh success/failure

## Testing

### Manual Testing Checklist

- [ ] Component loads without errors
- [ ] Shows "Not Connected" when no QB connection exists
- [ ] "Connect to QuickBooks" button redirects to QB OAuth page
- [ ] After QB authorization, redirects back and shows "Connected"
- [ ] Company name displays correctly when connected
- [ ] Token expiration date displays correctly
- [ ] Expiration status badge shows correct color based on days remaining
- [ ] "Refresh Status" button updates connection status
- [ ] Error messages display when organization ID is missing
- [ ] Dark mode styling works correctly
- [ ] Component is responsive on mobile/tablet

### Integration Testing

```bash
# Test connection status endpoint
node test-qb-endpoints.js

# Expected: Status endpoint returns 200 OK with connection data
```

## Troubleshooting

### "Organization ID not available" Error
- **Cause**: User context doesn't include `supabaseOrgID`
- **Solution**: Ensure user is properly logged in and organization ID is set in AppStateContext

### OAuth Redirect Not Working
- **Cause**: Backend redirect_uri doesn't match frontend URL
- **Solution**: Verify backend QuickBooks app configuration matches deployment URL

### "Failed to fetch connection status" Error
- **Cause**: Backend API not responding or HMAC auth failing
- **Solution**: Check backend logs, verify HMAC secret key matches between frontend/backend

### Company Info Not Loading
- **Cause**: QuickBooks API call failed or connection expired
- **Solution**: Reconnect to QuickBooks to refresh tokens

## Related Documentation

- [QuickBooks API Client Documentation](../src/api/quickbooksApi.js)
- [Backend API Tests](./QUICKBOOKS_BACKEND_API_TESTS.md)
- [QuickBooks Implementation Status](../QUICKBOOKS_IMPLEMENTATION_STATUS.md)
- [Backend Schema Verification](../BACKEND_SCHEMA_VERIFICATION_QUICKBOOKS.md)

## Version History

- **v1.0** (2026-01-16): Initial implementation with connection status, OAuth flow, and company info display
