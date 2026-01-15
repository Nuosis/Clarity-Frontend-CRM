# CustomerForm Component Usage Guide

## Overview

The `CustomerForm` component is a comprehensive form for creating and editing customers with support for multiple emails, phones, and addresses. It automatically adapts to the runtime environment (FileMaker vs Web App) and handles data formatting appropriately.

## Import

```javascript
import CustomerForm from './components/customers/CustomerForm';
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `customer` | Object | No | null | Existing customer data for edit mode. If provided, form enters edit mode. |
| `onClose` | Function | Yes | - | Callback function called when form is closed (cancel or after successful submission) |
| `darkMode` | Boolean | No | false | Whether to use dark mode styling |

## Usage Examples

### Create New Customer

```javascript
import { useState } from 'react';
import CustomerForm from './components/customers/CustomerForm';

function CustomerManagement() {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <button onClick={() => setShowForm(true)}>
        Create New Customer
      </button>

      {showForm && (
        <CustomerForm
          onClose={() => setShowForm(false)}
          darkMode={false}
        />
      )}
    </>
  );
}
```

### Edit Existing Customer

```javascript
import { useState } from 'react';
import CustomerForm from './components/customers/CustomerForm';

function CustomerManagement({ selectedCustomer }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <button onClick={() => setShowForm(true)}>
        Edit Customer
      </button>

      {showForm && (
        <CustomerForm
          customer={selectedCustomer}
          onClose={() => setShowForm(false)}
          darkMode={true}
        />
      )}
    </>
  );
}
```

## Customer Data Format

### Backend Format (Web App)

```javascript
const customer = {
  id: "uuid",
  business_name: "Acme Corporation",
  primary_contact_name: "John Doe",
  type: "CUSTOMER", // or "PROSPECT"
  is_active: true,
  emails: [
    {
      id: "email-uuid-1",
      email: "contact@acme.com",
      is_primary: true,
      email_type: "work"
    },
    {
      id: "email-uuid-2",
      email: "billing@acme.com",
      is_primary: false,
      email_type: "billing"
    }
  ],
  phones: [
    {
      id: "phone-uuid-1",
      phone: "+1 (555) 123-4567",
      is_primary: true,
      phone_type: "office"
    }
  ],
  addresses: [
    {
      id: "address-uuid-1",
      address_line1: "123 Main St",
      address_line2: "Suite 100",
      city: "San Francisco",
      state: "CA",
      postal_code: "94105",
      country: "USA",
      is_primary: true
    }
  ]
};
```

### FileMaker Format (Legacy)

```javascript
const customer = {
  __ID: "uuid",
  recordId: "42",
  Name: "Acme Corporation",
  ContactPerson: "John Doe",
  Email: "contact@acme.com",
  Phone: "+1 (555) 123-4567",
  Address: "123 Main St",
  City: "San Francisco",
  State: "CA",
  PostalCode: "94105",
  Country: "USA",
  f_active: "1", // "1" = active, "0" = inactive

  // Legacy fields
  OBSI_ClientNo: "12345",
  chargeRate: "150.00",
  f_USD: "1",
  f_EUR: "0",
  f_prePay: 1000,
  fundsAvailable: 5000,
  dbPath: "/path/to/db",
  dbUserName: "admin",
  dbPasword: "password"
};
```

### Hybrid Format (Supports Both)

The form automatically detects and handles both formats. When a customer has nested arrays, it uses them. Otherwise, it falls back to flat fields.

```javascript
const hybridCustomer = {
  __ID: "uuid",
  Name: "Acme Corporation", // Falls back if business_name missing
  business_name: "Acme Corporation", // Preferred

  // Can have either format
  Email: "contact@acme.com", // FileMaker flat
  emails: [ // Backend nested (preferred)
    { email: "contact@acme.com", is_primary: true, email_type: "work" }
  ]
};
```

## Field Reference

### Required Fields

- `business_name` (String) - Customer/business name

### Basic Information Fields

- `business_name` (String, required) - Customer or business name
- `primary_contact_name` (String, optional) - Primary contact person
- `type` (Enum, default: "CUSTOMER") - Customer type ("CUSTOMER" or "PROSPECT")
- `is_active` (Boolean, default: true) - Active status

### Email Fields

Each email object in the `emails` array:

- `email` (String) - Email address
- `is_primary` (Boolean) - Whether this is the primary email
- `email_type` (Enum) - Email type ("work", "personal", "billing")
- `id` (String, optional) - Existing email ID (for updates)

### Phone Fields

Each phone object in the `phones` array:

- `phone` (String) - Phone number
- `is_primary` (Boolean) - Whether this is the primary phone
- `phone_type` (Enum) - Phone type ("office", "mobile", "fax", "home")
- `id` (String, optional) - Existing phone ID (for updates)

### Address Fields

Each address object in the `addresses` array:

- `address_line1` (String) - Street address line 1
- `address_line2` (String, optional) - Street address line 2
- `city` (String) - City
- `state` (String) - State or province
- `postal_code` (String, optional) - Postal or ZIP code
- `country` (String, optional) - Country
- `is_primary` (Boolean) - Whether this is the primary address
- `id` (String, optional) - Existing address ID (for updates)

### Legacy FileMaker Fields (Only in FileMaker Environment)

- `OBSI_ClientNo` (String) - OBSI client number
- `chargeRate` (Number) - Hourly rate
- `f_USD` (Boolean) - USD currency flag
- `f_EUR` (Boolean) - EUR currency flag
- `f_prePay` (Number) - Pre-payment amount
- `fundsAvailable` (Number) - Available funds
- `dbPath` (String) - Database path
- `dbUserName` (String) - Database username
- `dbPasword` (String) - Database password (note: typo preserved for compatibility)

## Form Behavior

### Create Mode (customer prop not provided)

1. Form starts with one empty email, phone, and address
2. User can add more contacts using "+ Add" buttons
3. First contact is automatically marked as primary
4. On submit:
   - Validates required fields
   - Filters out empty contacts
   - Formats data for current environment
   - Creates customer via API
   - Refreshes customer list
   - Auto-selects newly created customer
   - Closes form

### Edit Mode (customer prop provided)

1. Form initializes with existing customer data
2. Handles both FileMaker and backend data formats
3. Preserves existing contact IDs for proper updates
4. User can add, edit, or remove contacts
5. On submit:
   - Validates required fields
   - Filters out empty contacts
   - Preserves existing IDs in update payload
   - Updates customer via API
   - Refreshes customer list
   - Closes form

### Environment Adaptation

#### Web App Environment
- Uses backend API (`POST /api/customers` or `PATCH /api/customers/:id`)
- Sends nested arrays for emails, phones, addresses
- Supports full relational data model
- Legacy FileMaker fields hidden

#### FileMaker Environment
- Uses FileMaker bridge API
- Sends flat data structure
- Only primary contacts included
- Legacy FileMaker fields visible
- Dual-write to Supabase (if authenticated)

## Contact Management

### Adding Contacts

- Click "+ Add Email/Phone/Address" button
- New empty contact added to array
- Marked as non-primary by default
- User fills in details

### Removing Contacts

- Click "Remove" button next to contact
- Contact removed from array
- Cannot remove if only one contact remains
- If removed contact was primary, first remaining contact becomes primary

### Primary Flag Management

- Exactly one contact of each type must be primary
- Checking "Primary" on one contact unchecks others
- Automatically enforced on add/remove operations
- Cannot uncheck primary without checking another

## Validation

### Client-Side Validation

- **business_name**: Required, cannot be empty
- **emails**: Must match email format regex (`/\S+@\S+\.\S+/`)
- **phones**: Must match phone format regex (`/^\+?[\d\s-()]+$/`)
- **chargeRate** (FileMaker only): Must be positive number

### Error Display

- Field-level errors shown below invalid fields
- Red border on invalid fields
- Form submission blocked until errors resolved

## Styling

### Light Mode
- White background
- Gray borders
- Blue accent buttons
- Red error text

### Dark Mode
- Dark gray background (`bg-gray-800`)
- Darker gray borders (`border-gray-700`)
- Blue accent buttons (same as light mode)
- Red error text (same as light mode)

### Responsive Design
- Mobile: Single column layout
- Desktop: Two-column grid for basic info
- Full-width sections for nested contacts
- Scrollable modal with max height

## Events

### onClose Callback

Called when:
- User clicks "Cancel" button
- User clicks "X" close button
- Form submission succeeds

Not called when:
- Validation fails
- API request fails (user can retry)

## Error Handling

### Validation Errors
- Displayed inline below fields
- Form submission blocked
- User must fix errors to proceed

### API Errors
- Displayed via SnackBar notification
- Form remains open
- User can retry or cancel

### Network Errors
- Handled by API layer
- Displayed via SnackBar notification
- Form remains open

## Integration with Other Components

### useCustomer Hook

```javascript
const { loadCustomers, handleCustomerSelect } = useCustomer();

// Form calls these after successful operations
await loadCustomers(); // Refresh customer list
await handleCustomerSelect(customerId); // Select newly created/updated customer
```

### SnackBar Context

```javascript
const { showError } = useSnackBar();

// Form uses this for notifications
showError('Customer created successfully'); // Success message
showError(`Error creating customer: ${error.message}`); // Error message
```

### AppStateContext

```javascript
const { setLoading } = useAppStateOperations();

// Form uses this for loading state
setLoading(true); // Show loading indicator
// ... API call ...
setLoading(false); // Hide loading indicator
```

## Performance Considerations

- Component wrapped in `React.memo` for optimization
- Form state only updates on user input
- Environment detection cached on mount
- Validation only runs on submit, not on every keystroke

## Accessibility

- Semantic HTML form elements
- Proper label associations
- Keyboard navigation support
- ARIA labels on close button
- Error messages associated with fields

## Best Practices

1. **Always provide onClose callback**
   ```javascript
   <CustomerForm onClose={handleClose} />
   ```

2. **Handle form closure properly**
   ```javascript
   const handleClose = () => {
     setShowForm(false);
     // Optionally refresh data or navigate
   };
   ```

3. **Pass complete customer object for edit mode**
   ```javascript
   // Ensure customer has all necessary fields
   const customerForEdit = {
     ...selectedCustomer,
     emails: selectedCustomer.emails || [],
     phones: selectedCustomer.phones || [],
     addresses: selectedCustomer.addresses || []
   };
   ```

4. **Use consistent darkMode across app**
   ```javascript
   const { darkMode } = useTheme();
   <CustomerForm darkMode={darkMode} />
   ```

## Troubleshooting

### Form doesn't populate in edit mode
- Ensure `customer` prop is not null/undefined
- Check that customer object has expected fields
- Verify customer data format matches expected structure

### Validation errors on valid data
- Check regex patterns match your data format
- Verify required fields are populated
- Look for whitespace-only values

### API errors on submission
- Check network connectivity
- Verify authentication (JWT or HMAC)
- Check API endpoint availability
- Review browser console for detailed errors

### Contacts not saving correctly
- Ensure at least one contact has is_primary: true
- Verify contact arrays are not empty after filtering
- Check that IDs are preserved for updates

## See Also

- [API Contracts](../requirements/customers/api-contracts.md)
- [Data Model Mapping](../requirements/customers/data-model-mapping.md)
- [Backend Integration Guide](../BACKEND_INTEGRATION_GUIDE.md)
- [Customer Service API](./CUSTOMER_SERVICE_API.md)
