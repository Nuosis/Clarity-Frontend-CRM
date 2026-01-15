# Customers Backend API Client

## Overview

The `customersBackend.js` module provides a clean, well-documented interface to the backend customer API endpoints. It leverages the `dataService` for environment-aware routing and authentication.

## Location

```
src/api/customersBackend.js
```

## Key Features

- **Environment Awareness**: Automatically routes requests through the correct authentication layer
  - Web app: JWT token from Supabase authentication
  - FileMaker: FileMaker bridge with script calls
- **Organization Scoping**: All requests automatically filtered by user's organization from JWT
- **Comprehensive Error Handling**: Validates inputs and provides clear error messages
- **Full CRUD Operations**: Create, Read, Update, Delete customers with related data
- **Batch Operations**: Support for bulk customer creation
- **Advanced Search**: Filter and search customers with multiple criteria

## Authentication & Authorization

### Web App Environment
- Uses JWT token from Supabase authentication (via `dataService`)
- Organization scoping: All requests automatically filtered by user's organization from JWT
- Token automatically included in `Authorization` header

### FileMaker Environment
- Routed through FileMaker bridge (via `dataService` interceptors)
- Uses existing FileMaker authentication
- Converted to FileMaker script calls automatically

### How It Works
The `dataService` handles all environment detection and authentication:
1. Request is made to backend API endpoint
2. `dataService` intercepts the request
3. Checks current environment (FileMaker vs Web App)
4. Routes through appropriate authentication layer
5. Returns response in consistent format

## API Functions

### List Customers

```javascript
import { listCustomers } from '../api/customersBackend.js';

// Basic usage - get first 50 customers
const customers = await listCustomers();

// With pagination
const customers = await listCustomers({
  limit: 100,
  offset: 0
});

// Filter by active status
const activeCustomers = await listCustomers({
  active: true
});

// Search customers
const results = await listCustomers({
  search: 'John',
  include_related: true
});
```

**Parameters:**
- `limit` (number, 1-200, default: 50): Maximum number of records
- `offset` (number, default: 0): Number of records to skip
- `active` (boolean, optional): Filter by active status
- `search` (string, optional): Search in name, business_name, first_name, last_name
- `include_related` (boolean, default: false): Include emails, phones, addresses

**Returns:** Array of customer objects

### Get Customer by ID

```javascript
import { getCustomerById } from '../api/customersBackend.js';

// Get customer with related data
const customer = await getCustomerById('123e4567-e89b-12d3-a456-426614174000');

// Get customer without related data (faster)
const customerBasic = await getCustomerById(id, {
  include_related: false
});
```

**Parameters:**
- `customerId` (string, required): Customer UUID
- `options.include_related` (boolean, default: true): Include emails, phones, addresses

**Returns:** Customer object with nested relationships

**Throws:** Error if customer not found or access denied (404)

### Create Customer

```javascript
import { createCustomer } from '../api/customersBackend.js';

// Basic customer
const customer = await createCustomer({
  name: 'Acme Corp',
  business_name: 'Acme Corporation',
  first_name: 'John',
  last_name: 'Doe'
});

// Customer with related records
const customer = await createCustomer({
  name: 'Acme Corp',
  business_name: 'Acme Corporation',
  is_active: true,
  emails: [
    {
      email: 'contact@acme.com',
      type: 'work',
      is_primary: true
    }
  ],
  phones: [
    {
      phone: '+1-555-0100',
      type: 'office',
      is_primary: true
    }
  ],
  addresses: [
    {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'USA',
      type: 'billing'
    }
  ]
});

// With idempotency key (prevents duplicate creates)
const customer = await createCustomer(
  { name: 'Acme Corp' },
  { idempotencyKey: 'unique-key-123' }
);
```

**Parameters:**
- `customerData.name` (string, required): Customer name
- `customerData.business_name` (string, optional): Business name
- `customerData.first_name` (string, optional): First name
- `customerData.last_name` (string, optional): Last name
- `customerData.is_active` (boolean, default: true): Active status
- `customerData.emails` (array, optional): Array of email objects
- `customerData.phones` (array, optional): Array of phone objects
- `customerData.addresses` (array, optional): Array of address objects
- `options.idempotencyKey` (string, optional): Prevents duplicate creates

**Returns:** Created customer object with all nested relationships

### Update Customer

```javascript
import { updateCustomer } from '../api/customersBackend.js';

// Update just the name
await updateCustomer(id, {
  name: 'New Name'
});

// Update multiple fields
await updateCustomer(id, {
  name: 'Updated Corp',
  business_name: 'Updated Corporation',
  is_active: true
});

// Update customer and related records
await updateCustomer(id, {
  name: 'Updated Corp',
  emails: [
    // Update existing email (include id)
    {
      id: 'existing-email-id',
      email: 'updated@example.com'
    },
    // Create new email (omit id)
    {
      email: 'new@example.com',
      type: 'work'
    }
  ]
});
```

**Parameters:**
- `customerId` (string, required): Customer UUID
- `customerData` (object, required): Updated customer data (partial)
  - All fields from create are optional
  - For related records (emails/phones/addresses):
    - Include `id` to update existing record
    - Omit `id` to create new record
    - Omitted records are NOT deleted

**Returns:** Updated customer object with all nested relationships

**Throws:** Error if customer not found or access denied (404)

### Delete Customer

```javascript
import { deleteCustomer } from '../api/customersBackend.js';

// Soft delete (sets is_active to false)
await deleteCustomer('123e4567-e89b-12d3-a456-426614174000');
```

**Parameters:**
- `customerId` (string, required): Customer UUID

**Returns:** Success status

**Throws:** Error if customer not found or access denied (404)

**Note:** This is a soft delete - sets `is_active` to false rather than removing the record.

### Update Customer Status

```javascript
import { updateCustomerStatus } from '../api/customersBackend.js';

// Deactivate customer
await updateCustomerStatus(id, false);

// Activate customer
await updateCustomerStatus(id, true);
```

**Parameters:**
- `customerId` (string, required): Customer UUID
- `isActive` (boolean, required): New active status

**Returns:** Updated customer object

### Batch Create Customers

```javascript
import { batchCreateCustomers } from '../api/customersBackend.js';

const result = await batchCreateCustomers([
  {
    name: 'Customer 1',
    emails: [{ email: 'c1@example.com' }]
  },
  {
    name: 'Customer 2',
    emails: [{ email: 'c2@example.com' }]
  }
]);
```

**Parameters:**
- `customers` (array, required): Array of customer data objects

**Returns:** Result object with created customers and any errors

### Search Customers

```javascript
import { searchCustomers } from '../api/customersBackend.js';

// Search by query
const results = await searchCustomers({
  query: 'John Doe',
  active: true
});

// Search by email
const emailResults = await searchCustomers({
  email: 'john@example.com'
});

// Search by phone
const phoneResults = await searchCustomers({
  phone: '+1-555-0100'
});
```

**Parameters:**
- `query` (string, optional): Search query string
- `email` (string, optional): Filter by email
- `phone` (string, optional): Filter by phone
- `active` (boolean, optional): Filter by active status
- `limit` (number, default: 50): Maximum results
- `offset` (number, default: 0): Pagination offset

**Returns:** Array of matching customer objects

### Convenience Methods

#### Fetch Active Customers
```javascript
import { fetchActiveCustomers } from '../api/customersBackend.js';

const activeCustomers = await fetchActiveCustomers({
  limit: 100
});
```

#### Fetch All Customers (Alias)
```javascript
import { fetchCustomers } from '../api/customersBackend.js';

const allCustomers = await fetchCustomers({
  limit: 200
});
```

#### Toggle Customer Status
```javascript
import { toggleCustomerStatus } from '../api/customersBackend.js';

await toggleCustomerStatus(id, false); // Deactivate
```

## Data Models

### Customer Object
```javascript
{
  id: "uuid",
  organization_id: "uuid",
  name: "string",
  business_name: "string (optional)",
  first_name: "string (optional)",
  last_name: "string (optional)",
  is_active: true,
  created_at: "timestamp",
  updated_at: "timestamp",

  // If include_related is true:
  emails: [
    {
      id: "uuid",
      customer_id: "uuid",
      email: "string",
      type: "work|personal|other",
      is_primary: true,
      created_at: "timestamp",
      updated_at: "timestamp"
    }
  ],
  phones: [
    {
      id: "uuid",
      customer_id: "uuid",
      phone: "string",
      type: "office|mobile|home|fax|other",
      is_primary: true,
      created_at: "timestamp",
      updated_at: "timestamp"
    }
  ],
  addresses: [
    {
      id: "uuid",
      customer_id: "uuid",
      street: "string (optional)",
      city: "string (optional)",
      state: "string (optional)",
      zip: "string (optional)",
      country: "string (optional)",
      type: "billing|shipping|other",
      is_primary: true,
      created_at: "timestamp",
      updated_at: "timestamp"
    }
  ]
}
```

## Error Handling

All functions validate inputs and throw descriptive errors:

```javascript
try {
  const customer = await getCustomerById(customerId);
} catch (error) {
  if (error.response?.status === 404) {
    console.error('Customer not found or access denied');
  } else if (error.response?.status === 401) {
    console.error('Authentication failed');
  } else {
    console.error('Operation failed:', error.message);
  }
}
```

## Best Practices

1. **Always validate customer ID before operations**
   ```javascript
   if (!customerId) {
     throw new Error('Customer ID is required');
   }
   ```

2. **Use pagination for large datasets**
   ```javascript
   const customers = await listCustomers({
     limit: 100,
     offset: page * 100
   });
   ```

3. **Include related data only when needed**
   ```javascript
   // Faster - no related data
   const customer = await getCustomerById(id, {
     include_related: false
   });

   // Slower but complete
   const customer = await getCustomerById(id, {
     include_related: true
   });
   ```

4. **Use idempotency keys for critical operations**
   ```javascript
   await createCustomer(data, {
     idempotencyKey: `import-${timestamp}-${index}`
   });
   ```

5. **Filter on the server, not the client**
   ```javascript
   // Good - server-side filtering
   const active = await listCustomers({ active: true });

   // Bad - client-side filtering
   const all = await listCustomers({ limit: 1000 });
   const active = all.filter(c => c.is_active);
   ```

## Migration from FileMaker API

If migrating from the existing FileMaker `customers.js` API:

### Before (FileMaker)
```javascript
import { fetchDataFromFileMaker } from './fileMaker';

const response = await fetchDataFromFileMaker({
  layout: 'devCustomers',
  action: 'READ',
  query: [{ "_custID": customerId }]
});
```

### After (Backend API)
```javascript
import { getCustomerById } from './customersBackend';

const customer = await getCustomerById(customerId);
```

## Environment-Aware Usage

The API client automatically adapts to the environment:

```javascript
// Same code works in both environments
import { listCustomers } from '../api/customersBackend.js';

// In Web App: Uses JWT authentication + Backend API
// In FileMaker: Routed through FileMaker bridge
const customers = await listCustomers();
```

## Testing

To test the API client in development:

```javascript
import { setEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService.js';
import { listCustomers } from '../api/customersBackend.js';

// Set environment context (normally done during authentication)
setEnvironmentContext({
  type: ENVIRONMENT_TYPES.WEBAPP,
  authentication: {
    isAuthenticated: true,
    method: 'supabase',
    user: { /* user data */ }
  }
});

// Now you can test the API
const customers = await listCustomers();
```

## Related Documentation

- `src/services/dataService.js` - Environment-aware routing and authentication
- `BACKEND_INTEGRATION_GUIDE.md` - Backend API integration patterns
- Backend API Docs: https://api.claritybusinesssolutions.ca/docs

## Support

For issues or questions:
1. Check backend API documentation: https://api.claritybusinesssolutions.ca/docs
2. Review CLAUDE.md for project guidelines
3. Check dataService.js for authentication patterns
