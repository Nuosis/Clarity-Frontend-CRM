# CustomerForm Quick Reference Guide

**Component:** `src/components/customers/CustomerForm.jsx`
**Purpose:** Create and edit customers with support for nested contacts (emails, phones, addresses)
**Environments:** FileMaker + Web App (dual-mode)

---

## Usage

```jsx
import CustomerForm from './components/customers/CustomerForm';

// Create mode
<CustomerForm
  onClose={handleClose}
  darkMode={isDark}
/>

// Edit mode
<CustomerForm
  customer={existingCustomer}
  onClose={handleClose}
  darkMode={isDark}
/>
```

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `customer` | Object | No | `null` | Existing customer data for edit mode. If null, creates new customer. |
| `onClose` | Function | Yes | - | Callback when form is closed/cancelled |
| `darkMode` | Boolean | No | `false` | Enable dark mode styling |

---

## Customer Data Format

### Web App Backend Format

```javascript
{
  business_name: "Acme Corp",           // Required
  primary_contact_name: "John Doe",    // Optional
  type: "CUSTOMER",                     // "CUSTOMER" or "PROSPECT"
  is_active: true,                      // Boolean
  emails: [
    {
      id: "uuid",                       // Optional (for updates)
      email: "john@acme.com",
      is_primary: true,                 // Exactly one must be true
      email_type: "work"                // "work", "personal", "billing"
    }
  ],
  phones: [
    {
      id: "uuid",
      phone: "+1-555-0100",
      is_primary: true,
      phone_type: "office"              // "office", "mobile", "fax", "home"
    }
  ],
  addresses: [
    {
      id: "uuid",
      address_line1: "123 Main St",
      address_line2: "Suite 100",       // Optional
      city: "San Francisco",
      state: "CA",
      postal_code: "94105",
      country: "USA",
      is_primary: true
    }
  ]
}
```

### FileMaker Format (Flat)

```javascript
{
  Name: "Acme Corp",                    // Maps to business_name
  ContactPerson: "John Doe",            // Maps to primary_contact_name
  Email: "john@acme.com",               // Primary email only
  Phone: "+1-555-0100",                 // Primary phone only
  Address: "123 Main St",
  City: "San Francisco",
  State: "CA",
  PostalCode: "94105",
  Country: "USA",
  f_active: "1",                        // String "1" or "0"
  // ... legacy fields
}
```

---

## Form Sections

### 1. Basic Information
- **Business Name** (required) - Main customer/company name
- **Primary Contact Name** (optional) - Main contact person
- **Type** (required) - CUSTOMER or PROSPECT
- **Active** (checkbox) - Customer status

### 2. Email Addresses
- Add/remove multiple emails
- Email address field (validated format)
- Type selector: work, personal, billing
- Primary flag (exactly one required)
- Remove button (disabled if only one email)

### 3. Phone Numbers
- Add/remove multiple phones
- Phone number field (validated format: `+?[\d\s-()]+`)
- Type selector: office, mobile, fax, home
- Primary flag (exactly one required)
- Remove button (disabled if only one phone)

### 4. Addresses
- Add/remove multiple addresses
- Address Line 1, Line 2 (optional)
- City, State, Postal Code, Country
- Primary flag (exactly one required)
- Remove button (disabled if only one address)

### 5. Additional Information (FileMaker only)
- OBSI Client No
- Charge Rate
- Pre-Pay Amount
- Funds Available
- Currency flags (USD, EUR)

### 6. Database Information (FileMaker only)
- Database Path
- Database Username
- Database Password

---

## Validation Rules

### Required Fields
- ✅ `business_name` - Must be non-empty after trim

### Email Validation
- ✅ Format: `/\S+@\S+\.\S+/`
- ✅ Example: "user@example.com"

### Phone Validation
- ✅ Format: `/^\+?[\d\s-()]+$/`
- ✅ Examples: "+1-555-0100", "(555) 123-4567", "555.123.4567"

### Primary Flags
- ✅ Exactly one email must be marked primary
- ✅ Exactly one phone must be marked primary
- ✅ Exactly one address must be marked primary
- ✅ Automatically enforced when toggling checkboxes
- ✅ Automatically preserved when removing items

### FileMaker-Specific
- ✅ Charge rate must be positive number (if provided)

---

## Behavior

### Create Mode (`customer` prop is `null`)

1. Form initializes with empty fields
2. One default email/phone/address pre-populated
3. Primary flags set to `true` on initial contacts
4. On submit:
   - Validates all fields
   - Filters out empty contacts
   - **Web App:** Submits nested data to backend API
   - **FileMaker:** Submits flat data + dual-writes to Supabase
5. After success:
   - Shows success message
   - Auto-selects newly created customer
   - Refreshes customer list
   - Closes form

### Edit Mode (`customer` prop is provided)

1. Form initializes from existing customer data
2. Supports both nested (backend) and flat (FileMaker) formats
3. Preserves contact IDs for updates
4. On submit:
   - Validates all fields
   - **Web App:** Updates via PATCH /api/customers/:id
   - **FileMaker:** Updates via FileMaker bridge + dual-write
5. After success:
   - Shows success message
   - Refreshes customer list
   - Closes form

### Environment Detection

Form automatically detects runtime environment via `getEnvironmentContext()`:

- **FileMaker:** `window.FileMaker` exists
- **Web App:** `window.FileMaker` does not exist

Different submission logic based on environment (no manual configuration needed).

---

## Common Operations

### Adding a Contact

**Email:**
```javascript
// User clicks "+ Add Email" button
// New email object added to emails array:
{ email: '', is_primary: false, email_type: 'work' }
```

**Phone:**
```javascript
// User clicks "+ Add Phone" button
// New phone object added to phones array:
{ phone: '', is_primary: false, phone_type: 'office' }
```

**Address:**
```javascript
// User clicks "+ Add Address" button
// New address object added to addresses array:
{
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  is_primary: false
}
```

### Removing a Contact

1. User clicks "Remove" button next to contact
2. Contact is removed from array
3. If removed contact was primary:
   - First remaining contact automatically marked primary
4. Remove button is disabled if only one contact remains

### Marking as Primary

1. User checks "Primary" checkbox on a contact
2. All other contacts of same type are unchecked
3. Only the selected contact has `is_primary: true`

### Submitting the Form

**Validation:**
1. All fields validated
2. If errors exist, submission blocked and errors shown
3. Empty contacts filtered out

**Web App Submission:**
```javascript
POST /api/customers  (create)
PATCH /api/customers/:id  (update)

Payload: {
  business_name: "...",
  emails: [...],
  phones: [...],
  addresses: [...]
}
```

**FileMaker Submission:**
```javascript
FileMaker bridge: createCustomer() / updateCustomer()

Payload: {
  Name: "...",
  Email: "...",  // Primary only
  Phone: "...",  // Primary only
  Address: "...", // Primary only
  // ... flat fields
}

+ Dual-write to Supabase (create only)
```

---

## Error Handling

### Field-Level Errors

Displayed inline below each field:

```jsx
{errors.business_name && (
  <p className="mt-1 text-red-500 text-sm">{errors.business_name}</p>
)}
```

### Submission Errors

Displayed via `SnackBarContext`:

```javascript
showError('Customer created successfully');  // Success
showError('Error creating customer: ...');    // Error
```

### Network Errors

Caught and displayed with helpful messages:

```javascript
catch (error) {
  console.error('Error creating customer:', error);
  showError(`Error creating customer: ${error.message}`);
}
```

---

## State Management

### Form State

```javascript
const [formData, setFormData] = useState({ ... });
const [emails, setEmails] = useState([...]);
const [phones, setPhones] = useState([...]);
const [addresses, setAddresses] = useState([...]);
const [errors, setErrors] = useState({});
```

### External State (via hooks)

```javascript
const { setLoading } = useAppStateOperations();
const { user } = useAppState();
const { createCustomerInSupabase } = useSupabaseCustomer();
const { loadCustomers, handleCustomerSelect } = useCustomer();
```

---

## Styling

### Dark Mode

All elements support dark mode via `darkMode` prop:

```jsx
className={`
  ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
`}
```

### Responsive Design

Form uses responsive grid layouts:

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

Mobile: Single column
Desktop: Two columns

---

## Dependencies

```javascript
import { v4 as uuidv4 } from 'uuid';                           // UUID generation
import { createCustomer, updateCustomer } from '../../api/customers';
import { useSnackBar } from '../../context/SnackBarContext';
import { useAppState, useAppStateOperations } from '../../context/AppStateContext';
import { useSupabaseCustomer } from '../../hooks/useSupabaseCustomer';
import { useCustomer } from '../../hooks/useCustomer';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from '../../services/dataService';
```

---

## Tips

### Best Practices

✅ Always provide `onClose` callback
✅ Use `customer` prop for edit mode, omit for create mode
✅ Let form handle primary flag enforcement automatically
✅ Don't manually manage environment detection
✅ Trust form validation before submission

### Common Mistakes

❌ Manually setting multiple primary flags to `true`
❌ Not providing at least one contact of each type
❌ Forgetting to refresh customer list after create/update
❌ Trying to override environment detection

### Performance

- Form re-renders are minimized via `React.memo`
- Large customer lists handled via pagination (separate component)
- Validation is synchronous and fast
- Network requests have loading states

---

## Related Files

- **API Client:** `src/api/customers.js`
- **Service Layer:** `src/services/customerService.js`
- **Hook:** `src/hooks/useCustomer.js`
- **Details View:** `src/components/customers/CustomerDetails.jsx`
- **Header View:** `src/components/customers/CustomerHeader.jsx`

---

## Documentation

- **Main Guide:** `docs/CUSTOMER_API_INTEGRATION.md`
- **Usage Examples:** `docs/CUSTOMER_FORM_USAGE.md`
- **Verification:** `docs/TSK0008_VERIFICATION_REPORT.md`

---

**Last Updated:** 2026-01-15
**Component Version:** 1.0 (TSK0008)
**Maintainer:** Clarity CRM Team
