# QuickBooks Configuration Panel

**Status:** ✅ Implemented (Backend Integration Pending)
**Location:** `src/components/financial/QuickBooksConfigPanel.jsx`
**Access Level:** Admin/Owner only

## Overview

The QuickBooks Configuration Panel provides an admin-only interface for managing organization-specific QuickBooks settings including tax codes, item IDs, invoice formatting, and synchronization preferences.

## Features

### Access Control
- **Admin-only access** - Component checks user role (`admin` or `owner`)
- Access denied message displayed to non-admin users
- No configuration data exposed to unauthorized users

### Configuration Options

#### Tax Configuration
- **CAD Tax Code** - Tax code for CAD currency invoices (default: 4)
- **Non-CAD Tax Code** - Tax code for USD/EUR currency invoices (default: 3)

#### Service Items by Currency
- **CAD Item** - ID and name for CAD development services (default: ID 3, "Development CAD")
- **USD Item** - ID and name for USD development services (default: ID 7, "Development USD")
- **EUR Item** - ID and name for EUR development services (default: ID 8, "Development EUR")

#### Invoice Settings
- **Default Currency** - CAD, USD, or EUR (default: CAD)
- **Default Payment Terms** - e.g., "Net 30" (default)
- **Invoice Number Format** - Pattern with placeholders: `{qboCustomerId}{YY}{MM}{NNN}`
  - `{qboCustomerId}` - QuickBooks customer ID
  - `{YY}` - 2-digit year
  - `{MM}` - 2-digit month
  - `{NNN}` - Sequential number
- **Default Email Delivery** - Send invoice emails by default (checkbox)

#### Sync Settings
- **Auto-sync Enabled** - Enable automatic invoice synchronization (checkbox)
- **Sync Frequency** - How often to sync invoices (1-168 hours, default: 24)

### UI Features
- **Change Detection** - Save button only enabled when changes are made
- **Reset Functionality** - Revert to initial configuration
- **Success/Error Feedback** - Clear messaging with auto-dismiss success notifications
- **Loading States** - Visual feedback during load/save operations
- **Dark Mode Support** - Fully responsive to theme changes
- **Responsive Design** - Mobile-friendly layout with grid responsive breakpoints

## Backend Integration Status

### Current Implementation
- **Data Storage:** localStorage (temporary - keyed by organization ID)
- **API Functions:** Ready but commented out
- **Backend Table:** `organization_quickbooks_config` - **NOT YET DEPLOYED**

### Production-Ready API Functions

```javascript
// src/api/quickbooksApi.js

/**
 * Get QuickBooks configuration for organization
 * @param {string} organizationId - Organization UUID
 * @returns {Promise<Object>} Configuration data
 */
export const getQuickBooksConfig = async (organizationId) => {
  const endpoint = `/config?organization_id=${encodeURIComponent(organizationId)}`;
  return await makeRequest(endpoint);
};

/**
 * Update QuickBooks configuration for organization
 * @param {string} organizationId - Organization UUID
 * @param {Object} configData - Configuration data to update
 * @returns {Promise<Object>} Updated configuration
 */
export const updateQuickBooksConfig = async (organizationId, configData) => {
  const data = { organization_id: organizationId, ...configData };
  return await makeRequest('/config', 'PUT', data);
};
```

### Migration to Backend API

Once backend deploys the schema (see `BACKEND_CHANGE_REQUEST_001_QUICKBOOKS_MIGRATION.md`):

1. **Uncomment API import** in `QuickBooksConfigPanel.jsx`:
   ```javascript
   import { getQuickBooksConfig, updateQuickBooksConfig } from '../../api/quickbooksApi';
   ```

2. **Replace localStorage in `loadConfiguration()`**:
   ```javascript
   // Replace this:
   const storageKey = `qb_config_${user.supabaseOrgID}`;
   const savedConfig = localStorage.getItem(storageKey);

   // With this:
   const response = await getQuickBooksConfig(user.supabaseOrgID);
   if (response.success) {
     setConfig(response.data);
     setInitialConfig(response.data);
   }
   ```

3. **Replace localStorage in `handleSave()`**:
   ```javascript
   // Replace this:
   const storageKey = `qb_config_${user.supabaseOrgID}`;
   localStorage.setItem(storageKey, JSON.stringify(config));

   // With this:
   const response = await updateQuickBooksConfig(user.supabaseOrgID, config);
   if (response.success) {
     setInitialConfig(config);
     setHasChanges(false);
     setSaveSuccess(true);
   }
   ```

4. **Remove backend integration notice** - Delete the blue info box at the top of the component

## Usage

### Integration in FinancialActivity

The component is integrated as a tab in the Financial Management screen:

```jsx
// src/components/financial/FinancialActivity.jsx
import QuickBooksConfigPanel from './QuickBooksConfigPanel';

// In tab navigation:
{ id: 'qb-config', label: 'QuickBooks Config' }

// In tab content:
{activeTab === 'qb-config' && (
  <QuickBooksConfigPanel darkMode={darkMode} />
)}
```

### User Flow

1. Navigate to Financial Management
2. Select "QuickBooks Config" tab
3. (Admin only) View current configuration
4. Make changes to any fields
5. Click "Save Configuration" (enabled only when changes detected)
6. See success confirmation
7. Optional: Click "Reset" to revert unsaved changes

### Data Model

```javascript
{
  // Tax Configuration
  cad_tax_code: 4,
  non_cad_tax_code: 3,

  // Item/Service IDs
  cad_item_id: '3',
  cad_item_name: 'Development CAD',
  usd_item_id: '7',
  usd_item_name: 'Development USD',
  eur_item_id: '8',
  eur_item_name: 'Development EUR',

  // Invoice Settings
  default_currency: 'CAD',
  default_payment_terms: 'Net 30',
  default_email_delivery: true,
  invoice_number_format: '{qboCustomerId}{YY}{MM}{NNN}',

  // Sync Settings
  auto_sync_enabled: true,
  sync_frequency_hours: 24
}
```

## Error Handling

- **Missing Organization ID** - Shows error message, prevents load/save
- **Load Failures** - Displays error with specific message, falls back to defaults
- **Save Failures** - Displays error with retry option via manual re-save
- **Access Denied** - Non-admins see friendly access restricted message

## Backend Requirements

### Required Schema

See `BACKEND_CHANGE_REQUEST_001_QUICKBOOKS_MIGRATION.md` for complete schema definition.

**Table:** `organization_quickbooks_config`
- `id` - UUID primary key
- `organization_id` - UUID (unique, references organizations)
- `cad_tax_code` - INTEGER
- `non_cad_tax_code` - INTEGER
- `cad_item_id`, `usd_item_id`, `eur_item_id` - TEXT
- `cad_item_name`, `usd_item_name`, `eur_item_name` - TEXT
- `default_currency` - TEXT (CAD, USD, EUR)
- `default_payment_terms` - TEXT
- `default_email_delivery` - BOOLEAN
- `invoice_number_format` - TEXT
- `auto_sync_enabled` - BOOLEAN
- `sync_frequency_hours` - INTEGER
- `created_at`, `updated_at` - TIMESTAMPTZ

### Required API Endpoints

- `GET /quickbooks/config?organization_id={uuid}` - Get configuration
- `PUT /quickbooks/config` - Update configuration (requires admin role)

### Authentication

- **Method:** HMAC-SHA256 via `makeRequest()` helper
- **Organization Header:** `X-Organization-ID` from user JWT claims
- **Role Requirement:** Admin or Owner (enforced by backend RLS)

## Testing

### Manual Testing Checklist

- [ ] Non-admin users see access denied message
- [ ] Admin users can view configuration form
- [ ] All fields are editable and validated
- [ ] Save button disabled when no changes
- [ ] Save button enabled when changes detected
- [ ] Reset button reverts to initial state
- [ ] Success message displays after save
- [ ] Error messages display on failures
- [ ] Dark mode styling works correctly
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] Backend integration notice is visible (until schema deployed)

### Automated Testing (TODO - TSK0008)

Integration tests for:
- Admin role validation
- Configuration load/save
- Field validation
- Change detection logic
- Error handling scenarios

## Related Documentation

- **Backend Schema:** `BACKEND_CHANGE_REQUEST_001_QUICKBOOKS_MIGRATION.md`
- **Schema Verification:** `BACKEND_SCHEMA_VERIFICATION_QUICKBOOKS.md`
- **Implementation Status:** `QUICKBOOKS_IMPLEMENTATION_STATUS.md`
- **API Reference:** `src/api/quickbooksApi.js`
- **Component Location:** `src/components/financial/QuickBooksConfigPanel.jsx`

## Changelog

### 2026-01-16 - Initial Implementation
- Created QuickBooksConfigPanel component
- Added API client functions (getQuickBooksConfig, updateQuickBooksConfig)
- Integrated into FinancialActivity as new tab
- Implemented admin-only access control
- Added comprehensive configuration form
- Implemented change detection and reset functionality
- Added success/error feedback
- Configured localStorage fallback for demo purposes
- Build verification passed

## Future Enhancements (Optional)

- **Validation Rules** - Add field-level validation (e.g., positive integers for tax codes)
- **Default Templates** - Provide multiple invoice number format templates
- **Preview** - Show example invoice number based on current format
- **Bulk Import** - Import configuration from QuickBooks account defaults
- **Audit Log** - Track configuration changes with user/timestamp
- **Multi-organization** - Support switching between orgs for super-admins
