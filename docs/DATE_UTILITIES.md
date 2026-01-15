# Date Utilities Documentation

## Overview

The date utility functions in `src/utils/dateUtils.js` provide robust date handling and conversion between FileMaker format (MM/DD/YYYY) and Supabase format (YYYY-MM-DD). All functions use the `date-fns` library for reliable date parsing and formatting.

## Installation

The `date-fns` library is a required dependency:

```bash
npm install date-fns
```

## Core Conversion Functions

### convertFileMakerToSupabase(fileMakerDate)

Converts FileMaker date format to Supabase format.

**Parameters:**
- `fileMakerDate` (string): Date in MM/DD/YYYY format

**Returns:**
- `string`: Date in YYYY-MM-DD format
- `null`: If input is invalid or cannot be parsed

**Example:**
```javascript
import { convertFileMakerToSupabase } from './utils/dateUtils';

convertFileMakerToSupabase('01/15/2026');  // '2026-01-15'
convertFileMakerToSupabase('5/3/2025');    // '2025-05-03'
convertFileMakerToSupabase('13/01/2025');  // null (invalid month)
```

### convertSupabaseToFileMaker(supabaseDate)

Converts Supabase date format to FileMaker format.

**Parameters:**
- `supabaseDate` (string): Date in YYYY-MM-DD format

**Returns:**
- `string`: Date in MM/DD/YYYY format
- `null`: If input is invalid or cannot be parsed

**Example:**
```javascript
import { convertSupabaseToFileMaker } from './utils/dateUtils';

convertSupabaseToFileMaker('2026-01-15');  // '01/15/2026'
convertSupabaseToFileMaker('2025-05-03');  // '05/03/2025'
convertSupabaseToFileMaker('2025-13-01');  // null (invalid month)
```

## Parsing Functions

### parseDate(dateString)

Parses a date string in various formats and returns a Date object.

**Supported Formats:**
- ISO format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss` (Supabase format)
- FileMaker/US format: `MM/DD/YYYY`
- Date objects (validates and returns)

**Parameters:**
- `dateString` (string|Date): Date string or Date object

**Returns:**
- `Date`: Parsed Date object
- `null`: If input is invalid

**Example:**
```javascript
import { parseDate } from './utils/dateUtils';

parseDate('2026-01-15');           // Date object
parseDate('01/15/2026');           // Date object
parseDate('2026-01-15T10:30:00');  // Date object
parseDate(new Date());             // Date object (validated)
parseDate('invalid');              // null
```

## Formatting Functions

### formatDate(date)

Formats a date to ISO format (YYYY-MM-DD) - Supabase standard.

**Parameters:**
- `date` (Date|string): Date object or date string

**Returns:**
- `string`: Formatted date in YYYY-MM-DD format
- `''`: Empty string if input is invalid

**Example:**
```javascript
import { formatDate } from './utils/dateUtils';

formatDate('01/15/2026');     // '2026-01-15'
formatDate(new Date());       // '2026-01-15'
formatDate('invalid');        // ''
```

### formatDateUS(date)

Formats a date to US/FileMaker format (MM/DD/YYYY).

**Parameters:**
- `date` (Date|string): Date object or date string

**Returns:**
- `string`: Formatted date in MM/DD/YYYY format
- `''`: Empty string if input is invalid

**Example:**
```javascript
import { formatDateUS } from './utils/dateUtils';

formatDateUS('2026-01-15');   // '01/15/2026'
formatDateUS(new Date());     // '01/15/2026'
```

### formatDateCanadian(date)

**Note:** Despite the name, this function now returns US format (MM/DD/YYYY) to match FileMaker expectations. This is an alias for `formatDateUS()`.

**Parameters:**
- `date` (Date|string): Date object or date string

**Returns:**
- `string`: Formatted date in MM/DD/YYYY format
- `''`: Empty string if input is invalid

### formatYearMonth(date)

Formats a date to YYYY-MM format for grouping.

**Parameters:**
- `date` (Date|string): Date object or date string

**Returns:**
- `string`: Formatted date in YYYY-MM format
- `''`: Empty string if input is invalid

**Example:**
```javascript
import { formatYearMonth } from './utils/dateUtils';

formatYearMonth('2026-01-15');  // '2026-01'
```

### formatMonthYear(date)

Formats a date to month name and year for display.

**Parameters:**
- `date` (Date|string): Date object or date string

**Returns:**
- `string`: Formatted month and year (e.g., "January 2026")
- `''`: Empty string if input is invalid

**Example:**
```javascript
import { formatMonthYear } from './utils/dateUtils';

formatMonthYear('2026-01-15');  // 'January 2026'
```

## Validation Functions

### isValidDate(dateString)

Checks if a date string can be successfully parsed.

**Parameters:**
- `dateString` (string|Date): Date string or Date object

**Returns:**
- `boolean`: True if valid, false otherwise

**Example:**
```javascript
import { isValidDate } from './utils/dateUtils';

isValidDate('2026-01-15');   // true
isValidDate('01/15/2026');   // true
isValidDate('invalid');      // false
```

### isValidFileMakerDate(dateString)

Validates if a string matches FileMaker date format (MM/DD/YYYY) and is a valid date.

**Parameters:**
- `dateString` (string): Date string to validate

**Returns:**
- `boolean`: True if matches MM/DD/YYYY format and is valid

**Example:**
```javascript
import { isValidFileMakerDate } from './utils/dateUtils';

isValidFileMakerDate('01/15/2026');   // true
isValidFileMakerDate('5/3/2025');     // true
isValidFileMakerDate('13/01/2025');   // false (invalid month)
isValidFileMakerDate('2026-01-15');   // false (wrong format)
```

### isValidSupabaseDate(dateString)

Validates if a string matches Supabase date format (YYYY-MM-DD) and is a valid date.

**Parameters:**
- `dateString` (string): Date string to validate

**Returns:**
- `boolean`: True if matches YYYY-MM-DD format and is valid

**Example:**
```javascript
import { isValidSupabaseDate } from './utils/dateUtils';

isValidSupabaseDate('2026-01-15');   // true
isValidSupabaseDate('2025-13-01');   // false (invalid month)
isValidSupabaseDate('01/15/2026');   // false (wrong format)
```

## Usage in API Clients

The date conversion functions are designed to be used in API client layers for transforming data between FileMaker and Supabase formats.

### Example: Financial Records API

```javascript
import { convertSupabaseToFileMaker, convertFileMakerToSupabase } from '../utils/dateUtils';

// Normalizing Supabase response to FileMaker format
function normalizeFinancialRecords(records) {
  return records.map(record => ({
    fieldData: {
      DateStart: convertSupabaseToFileMaker(record.date), // YYYY-MM-DD → MM/DD/YYYY
      // ... other fields
    }
  }));
}

// Converting FileMaker data to Supabase format
function createFinancialRecord(params) {
  const supabaseDate = convertFileMakerToSupabase(params.date); // MM/DD/YYYY → YYYY-MM-DD
  // ... use supabaseDate in API call
}
```

## Error Handling

All conversion and validation functions include comprehensive error handling:

- **Invalid formats**: Return `null` or `false` and log warnings
- **Invalid dates**: Return `null` or `false` and log warnings
- **Null/undefined inputs**: Return `null` or `false` without logging
- **Type errors**: Return `null` or `false`

**Example error output:**
```
[dateUtils] Invalid FileMaker date format: 2025-01-15. Expected MM/DD/YYYY
[dateUtils] Invalid date: 13/01/2025
```

## Testing

A comprehensive test script is available at `test-date-utils.js`:

```bash
node test-date-utils.js
```

**Test Coverage:**
- FileMaker ↔ Supabase conversions
- Round-trip conversions (both directions)
- Invalid date handling
- Edge cases (single-digit months/days)
- Date parsing from multiple formats
- All formatting functions
- All validation functions

## Migration Guide

### Replacing Inline Conversions

**Before:**
```javascript
// Inline conversion in API client
function convertToDisplayDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-');
  return `${month}/${day}/${year}`;
}
```

**After:**
```javascript
import { convertSupabaseToFileMaker } from '../utils/dateUtils';

// Use centralized utility
const displayDate = convertSupabaseToFileMaker(dateString);
```

### Benefits of Migration

1. **Consistency**: All date conversions use the same robust logic
2. **Validation**: Built-in format and validity checking
3. **Error Handling**: Comprehensive logging and null returns
4. **Maintainability**: Single source of truth for date operations
5. **Testing**: Centralized utilities are easier to test
6. **date-fns Integration**: Leverages battle-tested date library

## Best Practices

1. **Always validate dates** before conversion:
   ```javascript
   if (isValidFileMakerDate(dateString)) {
     const converted = convertFileMakerToSupabase(dateString);
   }
   ```

2. **Handle null returns** gracefully:
   ```javascript
   const supabaseDate = convertFileMakerToSupabase(fmDate);
   if (!supabaseDate) {
     console.error('Invalid date format');
     return;
   }
   ```

3. **Use appropriate format** for context:
   - **API calls to Supabase**: Use `YYYY-MM-DD` format
   - **Display to users**: Use `MM/DD/YYYY` format (US) or localized format
   - **Database queries**: Use `YYYY-MM-DD` format
   - **FileMaker compatibility**: Use `MM/DD/YYYY` format

4. **Prefer utility functions** over manual string manipulation:
   ```javascript
   // ❌ Don't do this
   const parts = date.split('/');
   const isoDate = `${parts[2]}-${parts[0]}-${parts[1]}`;

   // ✅ Do this
   const isoDate = convertFileMakerToSupabase(date);
   ```

## Related Files

- **Implementation**: `src/utils/dateUtils.js`
- **Tests**: `test-date-utils.js`
- **Exports**: `src/utils/index.js`
- **Usage Example**: `src/api/financialRecords.js`

## Dependencies

- **date-fns**: ^4.1.0 (or latest)
  - `parse`: Parse date strings with format patterns
  - `format`: Format dates with patterns
  - `isValid`: Validate Date objects
  - `parseISO`: Parse ISO 8601 date strings

## Changelog

### 2026-01-15 - Initial Implementation
- Added `convertFileMakerToSupabase()` and `convertSupabaseToFileMaker()`
- Updated `parseDate()` to use date-fns for robust parsing
- Updated all format functions to use date-fns
- Added validation functions for both formats
- Fixed bug in `formatDateCanadian()` (was using DD/MM/YYYY, now MM/DD/YYYY)
- Replaced inline conversions in `financialRecords.js` with utility functions
- Added comprehensive test suite
- Installed date-fns library
