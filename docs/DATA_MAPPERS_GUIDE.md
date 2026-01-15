# Data Mappers Guide

## Overview

The Data Mappers module (`src/utils/dataMappers.js`) provides transformation functions to convert data between FileMaker and Backend API formats. This is essential for the migration from FileMaker to Supabase, as the two systems use different data structures, naming conventions, and type formats.

## Key Features

- **Bidirectional Mapping**: Convert data both TO and FROM backend/FileMaker formats
- **Type Safety**: Handle type conversions (strings → booleans, strings → numbers)
- **Date Handling**: Convert between MM/DD/YYYY (FileMaker) and YYYY-MM-DD (ISO/Backend)
- **ID Transformations**: Handle recordId/__ID → UUID conversions
- **Field Name Mapping**: Transform between camelCase, snake_case, and custom field names
- **Validation**: Built-in validation functions to ensure data integrity
- **Batch Operations**: Process arrays of records efficiently

## Usage

### Import Mappers

```javascript
import {
    // Utility functions
    convertDateToISO,
    convertDateToFileMaker,
    convertToBoolean,
    safeParseFloat,

    // Financial record mappers
    mapFinancialRecordToBackend,
    mapFinancialRecordToFileMaker,

    // Task mappers
    mapTaskToBackend,
    mapTaskToFileMaker,

    // Timer mappers
    mapTimerToBackend,
    mapTimerToFileMaker,

    // Batch operations
    mapBatchToBackend,
    mapBatchToFileMaker,

    // Validation
    validateFinancialRecord
} from '@/utils/dataMappers';
```

## Common Transformations

### Date Conversions

#### FileMaker → Backend (ISO)

```javascript
const fmDate = '01/15/2026';
const isoDate = convertDateToISO(fmDate);
// Result: '2026-01-15'
```

#### Backend (ISO) → FileMaker

```javascript
const isoDate = '2026-01-15';
const fmDate = convertDateToFileMaker(isoDate);
// Result: '01/15/2026'
```

### Boolean Conversions

#### FileMaker (0/1) → Backend (boolean)

```javascript
const fmBoolean = '1'; // or 1, or '0', or 0
const jsBoolean = convertToBoolean(fmBoolean);
// Result: true or false
```

#### Backend (boolean) → FileMaker (0/1)

```javascript
import { convertToFileMakerBoolean } from '@/utils/dataMappers';

const jsBoolean = true;
const fmBoolean = convertToFileMakerBoolean(jsBoolean);
// Result: 1
```

### Numeric Conversions

```javascript
const fmNumber = '123.45'; // FileMaker often returns numbers as strings
const jsNumber = safeParseFloat(fmNumber);
// Result: 123.45

const invalidNumber = safeParseFloat('invalid', 100); // With default
// Result: 100
```

## Entity Mapping

### Financial Records

#### FileMaker → Backend

```javascript
const fmRecord = {
    recordId: '12345',
    fieldData: {
        __ID: 'abc123-def456',
        _custID: 'cust-123',
        DateStart: '01/15/2026',
        Billable_Time_Rounded: '5.5',
        Hourly_Rate: '100.00',
        'Customers::Name': 'Clarity Business Solutions',
        'customers_Projects::projectName': 'Development Work',
        f_billed: '0',
        '~creationTimestamp': '2026-01-15T10:00:00Z',
        '~modificationTimestamp': '2026-01-15T12:00:00Z'
    }
};

const organizationId = '123e4567-e89b-12d3-a456-426614174000';
const backendRecord = mapFinancialRecordToBackend(fmRecord, organizationId);

// Result:
// {
//     financial_id: 'abc123-def456',
//     organization_id: '123e4567-e89b-12d3-a456-426614174000',
//     customer_id: 'cust-123',
//     product_id: null,
//     product_name: 'CLARITYBUSINESSSOLUTIONS:Development',
//     quantity: 5.5,
//     unit_price: 100.00,
//     total_price: 550.00,
//     date: '2026-01-15',
//     inv_id: null,
//     created_at: '2026-01-15T10:00:00Z',
//     updated_at: '2026-01-15T12:00:00Z',
//     configuration_data: null
// }
```

#### Backend → FileMaker

```javascript
const backendRecord = {
    id: 'record-123',
    financial_id: 'abc123-def456',
    customer_id: 'cust-123',
    product_name: 'CLARITYBUSINESSSOLUTIONS:Development',
    quantity: 5.5,
    unit_price: 100.00,
    total_price: 550.00,
    date: '2026-01-15',
    inv_id: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T12:00:00Z'
};

const fmRecord = mapFinancialRecordToFileMaker(backendRecord);

// Result:
// {
//     recordId: 'record-123',
//     fieldData: {
//         __ID: 'abc123-def456',
//         _custID: 'cust-123',
//         DateStart: '01/15/2026',
//         Billable_Time_Rounded: 5.5,
//         Hourly_Rate: 100.00,
//         f_billed: 0,
//         product_name: 'CLARITYBUSINESSSOLUTIONS:Development',
//         '~creationTimestamp': '2026-01-15T10:00:00Z',
//         '~modificationTimestamp': '2026-01-15T12:00:00Z'
//     }
// }
```

### Tasks

#### FileMaker → Backend

```javascript
const fmTask = {
    recordId: '12345',
    fieldData: {
        __ID: 'task-123',
        _projectID: 'proj-123',
        _custID: 'cust-123',
        _staffID: 'staff-123',
        task: 'Complete feature implementation',
        notes: 'Some implementation notes',
        f_completed: '0', // String '0' or '1'
        priority: 'high',
        due_date: '01/20/2026'
    }
};

const backendTask = mapTaskToBackend(fmTask);

// Result:
// {
//     id: 'task-123',
//     project_id: 'proj-123',
//     customer_id: 'cust-123',
//     staff_id: 'staff-123',
//     task: 'Complete feature implementation',
//     notes: 'Some implementation notes',
//     completed: false, // Converted to boolean
//     priority: 'high',
//     due_date: '2026-01-20' // Converted to ISO format
// }
```

#### Backend → FileMaker

```javascript
const backendTask = {
    id: 'task-123',
    project_id: 'proj-123',
    task: 'Complete feature implementation',
    completed: true, // Boolean
    due_date: '2026-01-20'
};

const fmTask = mapTaskToFileMaker(backendTask);

// Result:
// {
//     recordId: 'task-123',
//     fieldData: {
//         __ID: 'task-123',
//         _projectID: 'proj-123',
//         task: 'Complete feature implementation',
//         f_completed: 1, // Converted to 0/1
//         due_date: '01/20/2026' // Converted to FileMaker format
//     }
// }
```

### Timers/Records

#### FileMaker → Backend

```javascript
const fmTimer = {
    recordId: '12345',
    fieldData: {
        __ID: 'timer-123',
        _taskID: 'task-123',
        _staffID: 'staff-123',
        _projectID: 'proj-123',
        _custID: 'cust-123',
        DateStart: '01/15/2026',
        TimeStart: '10:30:00',
        TimeEnd: '12:30:00',
        'Work Performed': 'Developed new feature',
        TimeAdjust: '300', // 5 minutes in seconds
        Billable_Time_Rounded: '2.0'
    }
};

const backendTimer = mapTimerToBackend(fmTimer);

// Result:
// {
//     id: 'timer-123',
//     task_id: 'task-123',
//     staff_id: 'staff-123',
//     project_id: 'proj-123',
//     customer_id: 'cust-123',
//     start_time: '2026-01-15T10:30:00',
//     end_time: '2026-01-15T12:30:00',
//     work_performed: 'Developed new feature',
//     time_adjust: 300,
//     billable_time: 2.0
// }
```

## Batch Operations

### Processing Multiple Records

```javascript
// Map array of FileMaker records to backend format
const fmRecords = [
    { fieldData: { __ID: 'task-1', task: 'Task 1', f_completed: '0' } },
    { fieldData: { __ID: 'task-2', task: 'Task 2', f_completed: '1' } }
];

const backendRecords = mapBatchToBackend(fmRecords, mapTaskToBackend);

// Result: Array of backend-formatted tasks
// [
//     { id: 'task-1', task: 'Task 1', completed: false },
//     { id: 'task-2', task: 'Task 2', completed: true }
// ]
```

```javascript
// Map array of backend records to FileMaker format
const backendRecords = [
    { id: 'task-1', task: 'Task 1', completed: false },
    { id: 'task-2', task: 'Task 2', completed: true }
];

const fmRecords = mapBatchToFileMaker(backendRecords, mapTaskToFileMaker);

// Result: Array of FileMaker-formatted tasks
```

## Validation

### Validate Financial Records

```javascript
const record = {
    financial_id: 'abc123',
    organization_id: 'org-123',
    customer_id: 'cust-123',
    date: '2026-01-15',
    quantity: 5.0,
    unit_price: 100.0,
    total_price: 500.0
};

const errors = validateFinancialRecord(record);

if (errors.length > 0) {
    console.error('Validation errors:', errors);
    // Handle validation errors
} else {
    // Record is valid, proceed with saving
}
```

### Validation Rules

The `validateFinancialRecord` function checks:

- **Required fields**: financial_id, organization_id, customer_id, date, quantity, unit_price, total_price
- **Non-negative values**: quantity ≥ 0, unit_price ≥ 0
- **Total price accuracy**: total_price must equal quantity × unit_price (within 0.01 tolerance)

## Integration Examples

### Using with Data Service

```javascript
import { dataService } from '@/services/dataService';
import { mapFinancialRecordToBackend, validateFinancialRecord } from '@/utils/dataMappers';

async function createFinancialRecord(fmRecord, organizationId) {
    // Transform FileMaker record to backend format
    const backendRecord = mapFinancialRecordToBackend(fmRecord, organizationId);

    // Validate before sending
    const errors = validateFinancialRecord(backendRecord);
    if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Send to backend API
    const response = await dataService.post('/financial-records', backendRecord);

    return response;
}
```

### Using with FileMaker API

```javascript
import { fetchDataFromFileMaker } from '@/api/fileMaker';
import { mapBatchToBackend, mapFinancialRecordToBackend } from '@/utils/dataMappers';

async function migrateFinancialRecords(organizationId) {
    // Fetch records from FileMaker
    const fmResponse = await fetchDataFromFileMaker({
        layout: 'dapiRecords',
        action: 'read',
        query: [{ "f_billed": "0" }] // Unbilled records
    });

    const fmRecords = fmResponse.response.data;

    // Transform all records to backend format
    const backendRecords = mapBatchToBackend(
        fmRecords,
        mapFinancialRecordToBackend,
        organizationId
    );

    // Validate all records
    const validRecords = backendRecords.filter(record => {
        const errors = validateFinancialRecord(record);
        if (errors.length > 0) {
            console.warn('Invalid record:', record.financial_id, errors);
            return false;
        }
        return true;
    });

    return validRecords;
}
```

## Field Mapping Reference

### Financial Records

| FileMaker Field | Backend Column | Transform |
|----------------|----------------|-----------|
| `__ID` | `financial_id` | Direct copy (UUID) |
| `_custID` | `customer_id` | Direct copy (UUID) |
| `DateStart` | `date` | MM/DD/YYYY → YYYY-MM-DD |
| `Billable_Time_Rounded` | `quantity` | String → Number (2 decimals) |
| `Hourly_Rate` | `unit_price` | String → Number (2 decimals) |
| *(calculated)* | `total_price` | quantity × unit_price (2 decimals) |
| `Customers::Name` + `customers_Projects::projectName` | `product_name` | Format: "CUSTOMERCAPS:ProjectFirstWord" |
| `f_billed` | `inv_id` | 0 → null, 1 → 'MIGRATED' |
| `~creationTimestamp` | `created_at` | Direct copy (ISO timestamp) |
| `~modificationTimestamp` | `updated_at` | Direct copy (ISO timestamp) |

### Tasks

| FileMaker Field | Backend Column | Transform |
|----------------|----------------|-----------|
| `__ID` | `id` | Direct copy (UUID) |
| `_projectID` | `project_id` | Direct copy (UUID) |
| `_custID` | `customer_id` | Direct copy (UUID) |
| `_staffID` | `staff_id` | Direct copy (UUID) |
| `task` | `task` | Direct copy |
| `notes` | `notes` | Direct copy |
| `f_completed` | `completed` | '0'/'1' → false/true |
| `priority` | `priority` | Direct copy |
| `due_date` | `due_date` | MM/DD/YYYY → YYYY-MM-DD |

### Timers

| FileMaker Field | Backend Column | Transform |
|----------------|----------------|-----------|
| `__ID` | `id` | Direct copy (UUID) |
| `_taskID` | `task_id` | Direct copy (UUID) |
| `_staffID` | `staff_id` | Direct copy (UUID) |
| `_projectID` | `project_id` | Direct copy (UUID) |
| `_custID` | `customer_id` | Direct copy (UUID) |
| `DateStart` + `TimeStart` | `start_time` | Combine to ISO timestamp |
| `DateStart` + `TimeEnd` | `end_time` | Combine to ISO timestamp |
| `Work Performed` | `work_performed` | Direct copy |
| `TimeAdjust` | `time_adjust` | String → Number (seconds) |
| `Billable_Time_Rounded` | `billable_time` | String → Number (hours) |

## Best Practices

### 1. Always Validate After Mapping

```javascript
const backendRecord = mapFinancialRecordToBackend(fmRecord, organizationId);
const errors = validateFinancialRecord(backendRecord);

if (errors.length > 0) {
    // Handle validation errors before proceeding
    throw new Error(`Validation failed: ${errors.join(', ')}`);
}
```

### 2. Handle Null/Undefined Values

The mappers handle null and undefined values gracefully:

```javascript
const fmRecord = {
    fieldData: {
        __ID: 'abc123',
        DateStart: null, // Will be converted to null in backend
        Billable_Time_Rounded: '', // Will default to 0
        'Customers::Name': null // Will result in empty product_name
    }
};

const backendRecord = mapFinancialRecordToBackend(fmRecord, organizationId);
// No errors thrown, but validation will catch missing required fields
```

### 3. Use Batch Operations for Performance

When processing multiple records, use batch operations instead of mapping individually:

```javascript
// ✅ Good - Single pass through array
const backendRecords = mapBatchToBackend(fmRecords, mapFinancialRecordToBackend, organizationId);

// ❌ Avoid - Multiple iterations
const backendRecords = fmRecords.map(record => mapFinancialRecordToBackend(record, organizationId));
```

### 4. Log Transformation Errors

```javascript
const backendRecords = mapBatchToBackend(
    fmRecords,
    (record, orgId) => {
        try {
            return mapFinancialRecordToBackend(record, orgId);
        } catch (error) {
            console.error('Failed to map record:', record.__ID || record.recordId, error);
            return null; // mapBatchToBackend filters out nulls
        }
    },
    organizationId
);

console.log(`Successfully mapped ${backendRecords.length} of ${fmRecords.length} records`);
```

## Testing

The mappers include comprehensive test coverage. To run tests:

```bash
node src/utils/verifyMappers.js
```

### Test Coverage

- ✅ Date conversions (MM/DD/YYYY ↔ YYYY-MM-DD)
- ✅ Boolean conversions (0/1 ↔ true/false)
- ✅ Numeric parsing and rounding
- ✅ Product name formatting
- ✅ Financial record mapping (bidirectional)
- ✅ Task mapping (bidirectional)
- ✅ Timer mapping (bidirectional)
- ✅ Validation rules
- ✅ Batch operations
- ✅ Edge cases and error handling

## Troubleshooting

### Product Name Not Formatting Correctly

**Issue**: Product name doesn't match expected format

**Solution**: Ensure both customer name and project name are provided:

```javascript
const productName = formatProductName('Clarity Business Solutions', 'Development Work');
// Result: 'CLARITYBUSINESSSOLUTIONS:Development'

// Not: formatProductName(null, 'Project') → ''
```

### Total Price Mismatch Errors

**Issue**: Validation fails with "total_price mismatch"

**Solution**: Ensure total_price is calculated correctly with proper rounding:

```javascript
const quantity = 7.33;
const unitPrice = 125.50;
const totalPrice = roundToTwoDecimals(quantity * unitPrice);
// Result: 919.92 (not 919.915)
```

### Date Format Errors

**Issue**: Dates not converting properly

**Solution**: Ensure dates are in expected format before conversion:

```javascript
// FileMaker format: MM/DD/YYYY
convertDateToISO('01/15/2026'); // ✅ Works
convertDateToISO('2026-01-15'); // ✅ Already ISO, returned as-is
convertDateToISO('15/01/2026'); // ❌ Invalid format, returns null
```

## Migration Workflow

### Typical Migration Flow

```javascript
import { dataService } from '@/services/dataService';
import {
    mapBatchToBackend,
    mapFinancialRecordToBackend,
    validateFinancialRecord
} from '@/utils/dataMappers';

async function migrateFinancialRecordsToBackend() {
    const organizationId = getCurrentOrganizationId();

    // 1. Fetch from FileMaker
    const fmRecords = await fetchDataFromFileMaker({
        layout: 'dapiRecords',
        action: 'read',
        query: [{ "__ID": "*" }]
    });

    // 2. Transform to backend format
    const backendRecords = mapBatchToBackend(
        fmRecords.response.data,
        mapFinancialRecordToBackend,
        organizationId
    );

    // 3. Validate all records
    const validRecords = [];
    const invalidRecords = [];

    for (const record of backendRecords) {
        const errors = validateFinancialRecord(record);
        if (errors.length === 0) {
            validRecords.push(record);
        } else {
            invalidRecords.push({ record, errors });
        }
    }

    console.log(`Valid: ${validRecords.length}, Invalid: ${invalidRecords.length}`);

    // 4. Bulk insert valid records
    if (validRecords.length > 0) {
        const response = await dataService.post('/financial-records/bulk', {
            records: validRecords
        });

        console.log(`Migrated ${response.inserted} records`);
    }

    // 5. Report invalid records
    if (invalidRecords.length > 0) {
        console.error('Failed to migrate the following records:');
        invalidRecords.forEach(({ record, errors }) => {
            console.error(`Record ${record.financial_id}:`, errors);
        });
    }

    return { validRecords, invalidRecords };
}
```

## API Reference

See the inline JSDoc documentation in `src/utils/dataMappers.js` for detailed API reference for each function.

---

**Last Updated**: 2026-01-14
**Version**: 1.0.0
