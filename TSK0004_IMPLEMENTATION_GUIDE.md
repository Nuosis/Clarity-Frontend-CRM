# TSK0004 Implementation Guide

## Backend Response Processing Functions

This guide explains how to use the new backend response processing functions in `customerService.js`.

## Quick Reference

### Processing Backend API Responses

```javascript
import {
    processBackendCustomerList,
    processBackendCustomerDetail,
    sortCustomers,
    searchCustomers,
    filterActiveCustomers,
    calculateCustomerStats,
    validateCustomerData
} from './services/customerService';

// Process list response from GET /api/customers
const response = await fetch('/api/customers?limit=50&include_related=true');
const json = await response.json();
const { customers, pagination } = processBackendCustomerList(json);

// Process detail response from GET /api/customers/:id
const detailResponse = await fetch('/api/customers/uuid-123');
const detailJson = await detailResponse.json();
const customer = processBackendCustomerDetail(detailJson);

// Calculate statistics
const stats = calculateCustomerStats(customers);
console.log(`Total: ${stats.total}, Active: ${stats.active}`);

// Sort customers
const sortedByName = sortCustomers(customers, { field: 'name', order: 'asc' });
const sortedByDate = sortCustomers(customers, { field: 'created', order: 'desc' });

// Search customers
const results = searchCustomers(customers, 'acme');

// Filter active customers
const activeCustomers = filterActiveCustomers(customers);

// Validate before sending to backend
const validation = validateCustomerData(formData, 'backend');
if (!validation.isValid) {
    console.error('Validation errors:', validation.errors);
}
```

## Detailed Function Documentation

### processBackendCustomerList(response)

Processes paginated customer list responses from the backend API.

**Input Formats Supported:**

```javascript
// Format 1: Success envelope with wrapped data
{
    success: true,
    data: {
        customers: [...],
        pagination: { total: 100, limit: 50, offset: 0, has_more: true }
    }
}

// Format 2: Direct wrapped data
{
    data: {
        customers: [...],
        pagination: {...}
    }
}

// Format 3: Direct array (legacy)
[{customer1}, {customer2}]
```

**Output:**

```javascript
{
    customers: [
        {
            id: 'uuid',
            Name: 'Business Name',      // Transformed from business_name
            Email: 'primary@email.com', // Extracted from emails[]
            Phone: '+1-555-1234',       // Extracted from phones[]
            Address: '123 Main St',     // Extracted from addresses[]
            isActive: true,             // Transformed from is_active
            ContactPerson: 'John Doe',  // Transformed from primary_contact_name
            createdAt: '2023-01-15T10:30:00Z',
            modifiedAt: '2023-12-01T14:45:00Z'
        }
    ],
    pagination: {
        total: 100,
        limit: 50,
        offset: 0,
        has_more: true
    }
}
```

**Example:**

```javascript
import { processBackendCustomerList } from './services/customerService';

async function loadCustomers(page = 0, limit = 50) {
    try {
        const response = await fetch(
            `/api/customers?limit=${limit}&offset=${page * limit}&include_related=true`
        );
        const json = await response.json();

        const { customers, pagination } = processBackendCustomerList(json);

        console.log(`Loaded ${customers.length} customers`);
        console.log(`Total available: ${pagination.total}`);
        console.log(`More pages: ${pagination.has_more}`);

        return { customers, pagination };
    } catch (error) {
        console.error('Failed to load customers:', error);
        throw error;
    }
}
```

### processBackendCustomerDetail(response)

Processes single customer detail response from the backend API.

**Input:**

```javascript
{
    success: true,
    data: {
        id: 'uuid',
        business_name: 'Acme Corp',
        is_active: true,
        primary_contact_name: 'John Doe',
        emails: [
            { id: 'email-1', email: 'primary@acme.com', is_primary: true },
            { id: 'email-2', email: 'billing@acme.com', is_primary: false }
        ],
        phones: [
            { id: 'phone-1', phone: '+1-555-1234', is_primary: true }
        ],
        addresses: [
            {
                id: 'addr-1',
                address_line1: '123 Main St',
                city: 'San Francisco',
                state: 'CA',
                postal_code: '94105',
                is_primary: true
            }
        ]
    }
}
```

**Output:**

```javascript
{
    id: 'uuid',
    Name: 'Acme Corp',
    isActive: true,
    ContactPerson: 'John Doe',
    Email: 'primary@acme.com',    // Primary email extracted
    Phone: '+1-555-1234',          // Primary phone extracted
    Address: '123 Main St',        // Primary address extracted
    emails: [...],                 // All emails preserved
    phones: [...],                 // All phones preserved
    addresses: [...],              // All addresses preserved
    createdAt: '...',
    modifiedAt: '...'
}
```

**Example:**

```javascript
import { processBackendCustomerDetail } from './services/customerService';

async function loadCustomerDetail(customerId) {
    try {
        const response = await fetch(`/api/customers/${customerId}`);
        const json = await response.json();

        const customer = processBackendCustomerDetail(json);

        console.log(`Customer: ${customer.Name}`);
        console.log(`Primary Email: ${customer.Email}`);
        console.log(`Additional Emails: ${customer.emails?.length || 0}`);

        return customer;
    } catch (error) {
        console.error('Failed to load customer detail:', error);
        throw error;
    }
}
```

### sortCustomers(customers, options)

Sorts customer array with configurable field and order.

**Options:**

```javascript
{
    field: 'name' | 'created' | 'modified',  // Default: 'name'
    order: 'asc' | 'desc'                    // Default: 'asc'
}
```

**Field Mappings:**
- `name`: Sorts by Name (FileMaker) or business_name (backend)
- `created`: Sorts by createdAt or created_at
- `modified`: Sorts by modifiedAt or updated_at

**Example:**

```javascript
import { sortCustomers } from './services/customerService';

// Sort by name (active customers first, then alphabetical)
const byName = sortCustomers(customers, { field: 'name', order: 'asc' });

// Sort by creation date (newest first)
const newest = sortCustomers(customers, { field: 'created', order: 'desc' });

// Sort by last modified (oldest first)
const oldest = sortCustomers(customers, { field: 'modified', order: 'asc' });
```

### calculateCustomerStats(customers)

Calculates comprehensive statistics from customer array.

**Output:**

```javascript
{
    total: 127,        // Total number of customers
    active: 98,        // Number of active customers
    inactive: 29,      // Number of inactive customers
    withEmail: 125,    // Customers with at least one email
    withPhone: 110,    // Customers with at least one phone
    withAddress: 95    // Customers with at least one address
}
```

**Example:**

```javascript
import { calculateCustomerStats } from './services/customerService';

const stats = calculateCustomerStats(customers);

console.log(`Total Customers: ${stats.total}`);
console.log(`Active: ${stats.active} (${Math.round(stats.active / stats.total * 100)}%)`);
console.log(`With Contact Info:`);
console.log(`  - Email: ${stats.withEmail}`);
console.log(`  - Phone: ${stats.withPhone}`);
console.log(`  - Address: ${stats.withAddress}`);

// Use in UI dashboard
function CustomerStatsWidget({ customers }) {
    const stats = calculateCustomerStats(customers);

    return (
        <div className="stats-widget">
            <Stat label="Total" value={stats.total} />
            <Stat label="Active" value={stats.active} color="green" />
            <Stat label="Inactive" value={stats.inactive} color="gray" />
            <Stat label="With Email" value={stats.withEmail} />
            <Stat label="With Phone" value={stats.withPhone} />
        </div>
    );
}
```

### searchCustomers(customers, query)

Client-side search across multiple customer fields.

**Search Fields:**
- Name (both Name and business_name)
- Contact Person (ContactPerson and primary_contact_name)
- Email (flat and nested formats)
- Phone (flat and nested formats)

**Example:**

```javascript
import { searchCustomers } from './services/customerService';

// Search for customers
const results = searchCustomers(customers, 'acme');
console.log(`Found ${results.length} customers matching "acme"`);

// Use in search UI
function CustomerSearchBox({ customers }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);

    useEffect(() => {
        if (query.trim()) {
            const filtered = searchCustomers(customers, query);
            setResults(filtered);
        } else {
            setResults(customers);
        }
    }, [query, customers]);

    return (
        <div>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customers..."
            />
            <CustomerList customers={results} />
        </div>
    );
}
```

### filterActiveCustomers(customers)

Filters customer array to only active customers.

**Example:**

```javascript
import { filterActiveCustomers } from './services/customerService';

const activeOnly = filterActiveCustomers(customers);
console.log(`${activeOnly.length} active out of ${customers.length} total`);

// Use in component
function ActiveCustomersList({ customers }) {
    const activeCustomers = filterActiveCustomers(customers);

    return (
        <div>
            <h3>Active Customers ({activeCustomers.length})</h3>
            {activeCustomers.map(customer => (
                <CustomerCard key={customer.id} customer={customer} />
            ))}
        </div>
    );
}
```

### validateCustomerData(data, format)

Validates customer data before submission.

**Formats:**
- `'filemaker'`: FileMaker validation rules (default)
- `'backend'`: Backend API validation rules

**FileMaker Validation:**
- Name is required
- Email format validation (if provided)
- Phone format validation (if provided)

**Backend Validation:**
- business_name is required
- business_name max length: 255 characters
- Email format validation in emails[] array
- Phone format validation in phones[] array

**Output:**

```javascript
{
    isValid: true,
    errors: []
}

// OR

{
    isValid: false,
    errors: [
        'Business name is required',
        'Invalid email format at position 1'
    ]
}
```

**Example:**

```javascript
import { validateCustomerData } from './services/customerService';

// Validate before sending to backend
async function createCustomer(formData) {
    const backendData = {
        business_name: formData.businessName,
        primary_contact_name: formData.contactPerson,
        emails: [{ email: formData.email, is_primary: true }],
        phones: [{ phone: formData.phone, is_primary: true }]
    };

    const validation = validateCustomerData(backendData, 'backend');

    if (!validation.isValid) {
        console.error('Validation failed:', validation.errors);
        return { success: false, errors: validation.errors };
    }

    // Send to backend
    const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendData)
    });

    return response.json();
}

// Use in form component
function CustomerForm({ onSubmit }) {
    const [formData, setFormData] = useState({});
    const [validationErrors, setValidationErrors] = useState([]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const validation = validateCustomerData(formData, 'backend');

        if (!validation.isValid) {
            setValidationErrors(validation.errors);
            return;
        }

        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            {validationErrors.length > 0 && (
                <div className="errors">
                    {validationErrors.map((error, i) => (
                        <div key={i} className="error">{error}</div>
                    ))}
                </div>
            )}
            {/* Form fields */}
        </form>
    );
}
```

## Common Patterns

### Pattern 1: Load and Display Customers

```javascript
import {
    processBackendCustomerList,
    sortCustomers,
    filterActiveCustomers
} from './services/customerService';

async function loadAndDisplayCustomers() {
    // Load from backend
    const response = await fetch('/api/customers?limit=100&include_related=true');
    const json = await response.json();

    // Process response
    const { customers, pagination } = processBackendCustomerList(json);

    // Filter active only
    const activeCustomers = filterActiveCustomers(customers);

    // Sort by name
    const sorted = sortCustomers(activeCustomers, { field: 'name', order: 'asc' });

    return { customers: sorted, pagination };
}
```

### Pattern 2: Search and Filter

```javascript
import {
    searchCustomers,
    filterActiveCustomers,
    sortCustomers
} from './services/customerService';

function searchAndFilter(customers, query, activeOnly = false) {
    // Apply search
    let results = query ? searchCustomers(customers, query) : customers;

    // Apply active filter
    if (activeOnly) {
        results = filterActiveCustomers(results);
    }

    // Sort results
    results = sortCustomers(results, { field: 'name', order: 'asc' });

    return results;
}
```

### Pattern 3: Stats Dashboard

```javascript
import {
    calculateCustomerStats,
    filterActiveCustomers
} from './services/customerService';

function CustomerDashboard({ customers }) {
    const allStats = calculateCustomerStats(customers);
    const activeCustomers = filterActiveCustomers(customers);
    const activeStats = calculateCustomerStats(activeCustomers);

    return (
        <div className="dashboard">
            <StatCard title="All Customers" stats={allStats} />
            <StatCard title="Active Customers" stats={activeStats} />
            <CompletionRate
                withEmail={allStats.withEmail}
                withPhone={allStats.withPhone}
                total={allStats.total}
            />
        </div>
    );
}
```

## Migration from FileMaker Processing

If you're currently using `processCustomerData()` for FileMaker, no changes are needed. The new functions work alongside the existing FileMaker processing:

```javascript
import {
    processCustomerData,           // FileMaker processing (unchanged)
    processBackendCustomerList,    // Backend processing (new)
    processBackendCustomerDetail   // Backend processing (new)
} from './services/customerService';

// Environment-aware processing
async function loadCustomers() {
    if (isFileMakerEnvironment()) {
        const fmData = await fetchFromFileMaker();
        return processCustomerData(fmData);
    } else {
        const backendData = await fetchFromBackend();
        const { customers } = processBackendCustomerList(backendData);
        return customers;
    }
}
```

## Error Handling

All processing functions include error handling:

```javascript
import { processBackendCustomerDetail } from './services/customerService';

try {
    const customer = processBackendCustomerDetail(response);
    console.log('Customer loaded:', customer.Name);
} catch (error) {
    if (error.message === 'Invalid customer data received from backend') {
        console.error('Backend returned invalid data');
    } else {
        console.error('Unexpected error:', error);
    }
}
```

## Next Steps

After TSK0004, the following tasks will integrate these functions:

- **TSK0005**: `useCustomer` hook will call these processing functions
- **TSK0007**: `CustomerDetails` component will display the processed data
- **TSK0008**: `CustomerForm` will use validation and transformation functions

## Related Documentation

- [TSK0003 Completion Summary](./TRANSFORMATION_UTILITIES_SUMMARY.md) - Data transformation utilities
- [Backend API Contracts](./requirements/customers/api-contracts.md) - API endpoint specifications
- [Data Model Mapping](./requirements/customers/data-model-mapping.md) - FileMaker ↔ Backend mapping
