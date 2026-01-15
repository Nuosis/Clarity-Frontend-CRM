# Customer Service API Reference

## Overview
The `customerService.js` module provides functions for processing and transforming customer data between FileMaker flat format and backend relational format with nested relationships.

## Quick Start

```javascript
import {
  processBackendCustomerList,
  processBackendCustomerDetail,
  filterActiveCustomers,
  sortCustomers,
  calculateCustomerStats
} from './services/customerService';
```

## Backend Response Processing

### processBackendCustomerList(response)
Process paginated customer list from backend API.

**Parameters**:
- `response` (Object) - Backend API response

**Returns**: Object with `customers` array and `pagination` metadata

**Example**:
```javascript
// Backend API response
const apiResponse = {
  success: true,
  data: {
    customers: [
      {
        id: 'uuid',
        business_name: 'Acme Corp',
        is_active: true,
        emails: [{ email: 'contact@acme.com', is_primary: true }],
        phones: [{ phone: '+1 555-0000', is_primary: true }],
        addresses: [{ address_line1: '123 Main', city: 'SF', state: 'CA' }]
      }
    ],
    pagination: { total: 100, limit: 50, offset: 0, has_more: true }
  }
};

// Process response
const result = processBackendCustomerList(apiResponse);
// result.customers = [{ Name: 'Acme Corp', Email: 'contact@acme.com', ... }]
// result.pagination = { total: 100, limit: 50, offset: 0, has_more: true }
```

### processBackendCustomerDetail(response)
Process single customer detail from backend API.

**Parameters**:
- `response` (Object) - Backend API response

**Returns**: Customer object in FileMaker format

**Example**:
```javascript
const apiResponse = {
  success: true,
  data: {
    id: 'uuid',
    business_name: 'Acme Corp',
    primary_contact_name: 'John Doe',
    emails: [{ email: 'john@acme.com', is_primary: true }],
    phones: [{ phone: '+1 555-0000', is_primary: true }]
  }
};

const customer = processBackendCustomerDetail(apiResponse);
// customer = { id: 'uuid', Name: 'Acme Corp', ContactPerson: 'John Doe',
//              Email: 'john@acme.com', Phone: '+1 555-0000', ... }
```

## Customer Operations

### filterActiveCustomers(customers)
Filter customers by active status.

**Parameters**:
- `customers` (Array) - Customer records

**Returns**: Array of active customers

**Example**:
```javascript
const activeCustomers = filterActiveCustomers(allCustomers);
```

### sortCustomers(customers, options)
Sort customers with configurable field and order.

**Parameters**:
- `customers` (Array) - Customer records
- `options` (Object) - Sort configuration
  - `field` (String) - 'name' | 'created' | 'modified' (default: 'name')
  - `order` (String) - 'asc' | 'desc' (default: 'asc')

**Returns**: Sorted array (active customers always listed first)

**Examples**:
```javascript
// Sort by name ascending (default)
const sorted = sortCustomers(customers);

// Sort by name descending
const sorted = sortCustomers(customers, { field: 'name', order: 'desc' });

// Sort by creation date, newest first
const sorted = sortCustomers(customers, { field: 'created', order: 'desc' });

// Sort by modification date
const sorted = sortCustomers(customers, { field: 'modified', order: 'asc' });
```

### calculateCustomerStats(customers)
Calculate comprehensive customer statistics.

**Parameters**:
- `customers` (Array) - Customer records

**Returns**: Statistics object

**Example**:
```javascript
const stats = calculateCustomerStats(customers);
// stats = {
//   total: 127,
//   active: 95,
//   inactive: 32,
//   withEmail: 120,
//   withPhone: 115,
//   withAddress: 110
// }
```

### groupCustomersByStatus(customers)
Group customers by active/inactive status.

**Parameters**:
- `customers` (Array) - Customer records

**Returns**: Object with `active` and `inactive` arrays

**Example**:
```javascript
const grouped = groupCustomersByStatus(customers);
// grouped = {
//   active: [{ Name: 'Acme Corp', ... }],
//   inactive: [{ Name: 'Old Corp', ... }]
// }
```

## Data Transformation

### transformBackendToFileMaker(backendCustomer)
Transform backend relational format to FileMaker flat format.

**Parameters**:
- `backendCustomer` (Object) - Customer from backend API

**Returns**: Customer in FileMaker format

**Example**:
```javascript
const backendCustomer = {
  id: 'uuid',
  business_name: 'Acme Corp',
  is_active: true,
  emails: [
    { email: 'primary@acme.com', is_primary: true },
    { email: 'billing@acme.com', is_primary: false }
  ],
  phones: [{ phone: '+1 555-0000', is_primary: true }],
  addresses: [{
    address_line1: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    postal_code: '94105'
  }]
};

const fileMakerCustomer = transformBackendToFileMaker(backendCustomer);
// fileMakerCustomer = {
//   id: 'uuid',
//   Name: 'Acme Corp',
//   isActive: true,
//   Email: 'primary@acme.com',  // Primary extracted
//   Phone: '+1 555-0000',       // Primary extracted
//   Address: '123 Main St',     // Primary extracted
//   City: 'San Francisco',
//   State: 'CA',
//   PostalCode: '94105'
// }
```

### transformFileMakerToBackend(fileMakerCustomer)
Transform FileMaker flat format to backend relational format.

**Parameters**:
- `fileMakerCustomer` (Object) - Customer from FileMaker

**Returns**: Customer in backend API format

**Example**:
```javascript
const fileMakerCustomer = {
  __ID: 'fm-123',
  Name: 'Acme Corp',
  Email: 'contact@acme.com',
  Phone: '+1 555-0000',
  Address: '123 Main St',
  City: 'San Francisco',
  State: 'CA',
  f_active: '1'
};

const backendCustomer = transformFileMakerToBackend(fileMakerCustomer);
// backendCustomer = {
//   id: 'fm-123',
//   business_name: 'Acme Corp',
//   is_active: true,
//   emails: [{ email: 'contact@acme.com', is_primary: true }],
//   phones: [{ phone: '+1 555-0000', is_primary: true }],
//   addresses: [{
//     address_line1: '123 Main St',
//     city: 'San Francisco',
//     state: 'CA'
//   }]
// }
```

## Validation

### validateCustomerData(data, format)
Validate customer data before save.

**Parameters**:
- `data` (Object) - Customer data
- `format` (String) - 'filemaker' | 'backend' (default: 'filemaker')

**Returns**: Object with `isValid` boolean and `errors` array

**Example**:
```javascript
// Validate FileMaker format
const validation = validateCustomerData({
  Name: 'Acme Corp',
  Email: 'invalid-email',  // Invalid
  Phone: '555-0000'
}, 'filemaker');
// validation = {
//   isValid: false,
//   errors: ['Invalid email format']
// }

// Validate backend format
const validation = validateCustomerData({
  business_name: '',  // Required
  emails: [{ email: 'test@example.com' }]
}, 'backend');
// validation = {
//   isValid: false,
//   errors: ['Business name is required']
// }
```

### validateTransformedData(customerData, format)
Validate transformed customer data structure.

**Parameters**:
- `customerData` (Object) - Customer data
- `format` (String) - 'filemaker' | 'backend' (default: 'backend')

**Returns**: Object with `isValid` boolean and `errors` array

## Batch Operations

### transformBackendArrayToFileMaker(backendCustomers)
Transform array of backend customers to FileMaker format.

**Parameters**:
- `backendCustomers` (Array) - Backend customer records

**Returns**: Object with `customers` array and `errors` array

**Example**:
```javascript
const result = transformBackendArrayToFileMaker([
  { id: '1', business_name: 'Acme', is_active: true },
  { id: '2', business_name: 'Beta', is_active: false }
]);
// result = {
//   customers: [{ id: '1', Name: 'Acme', ... }, { id: '2', Name: 'Beta', ... }],
//   errors: []
// }
```

### transformFileMakerArrayToBackend(fileMakerCustomers)
Transform array of FileMaker customers to backend format.

**Parameters**:
- `fileMakerCustomers` (Array) - FileMaker customer records

**Returns**: Object with `customers` array and `errors` array

## Utility Functions

### extractPrimaryContact(contacts, field)
Extract primary contact from nested array.

**Parameters**:
- `contacts` (Array) - Email or phone objects
- `field` (String) - 'email' | 'phone'

**Returns**: Primary contact value or null

**Example**:
```javascript
const emails = [
  { email: 'billing@acme.com', is_primary: false },
  { email: 'contact@acme.com', is_primary: true }
];
const primaryEmail = extractPrimaryContact(emails, 'email');
// primaryEmail = 'contact@acme.com'
```

### extractPrimaryAddress(addresses)
Extract primary address from nested array.

**Parameters**:
- `addresses` (Array) - Address objects

**Returns**: Address object with flat fields or null

**Example**:
```javascript
const addresses = [
  { address_line1: '123 Main', city: 'SF', state: 'CA', is_primary: true }
];
const address = extractPrimaryAddress(addresses);
// address = { Address: '123 Main', City: 'SF', State: 'CA', ... }
```

## Format Compatibility

All functions handle both FileMaker and backend data formats:

| Format | Field Names | Structure |
|--------|-------------|-----------|
| FileMaker | `Name`, `Email`, `Phone`, `isActive` | Flat (single values) |
| Backend | `business_name`, `is_active` | Relational (nested arrays) |

The service layer automatically transforms backend responses to FileMaker format, so UI components receive consistent data regardless of the source.

## Error Handling

Functions return sensible defaults for invalid input:
- `null` or `undefined` → Empty arrays or zero stats
- Missing fields → Gracefully omitted or null values
- Invalid format → Validation errors array

## Best Practices

1. **Always process backend responses**: Use `processBackendCustomerList` or `processBackendCustomerDetail` for API responses
2. **Transform at the boundary**: Convert data formats at the service layer, not in UI components
3. **Use validation**: Call `validateCustomerData` before save operations
4. **Handle errors**: Check validation results and transformation errors arrays
5. **Leverage batch operations**: Use array transformation functions for bulk operations

## See Also

- [Backend Integration Guide](../BACKEND_INTEGRATION_GUIDE.md)
- [API Contracts](../requirements/customers/api-contracts.md)
- [Data Model Mapping](../requirements/customers/data-model-mapping.md)
