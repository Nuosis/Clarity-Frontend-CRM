# Date Utilities Quick Reference

## Quick Import

```javascript
import {
  convertFileMakerToSupabase,
  convertSupabaseToFileMaker,
  isValidFileMakerDate,
  isValidSupabaseDate
} from '../utils/dateUtils';
```

## Common Use Cases

### 1. Converting for API Calls (Frontend → Backend)

```javascript
// User input or FileMaker data: MM/DD/YYYY
const fmDate = '01/15/2026';

// Convert to Supabase format: YYYY-MM-DD
const sbDate = convertFileMakerToSupabase(fmDate);
// Result: '2026-01-15'

// Use in Supabase RPC
await supabase.rpc('create_financial_record', {
  p_date: sbDate,
  // ...
});
```

### 2. Converting for Display (Backend → Frontend)

```javascript
// Supabase response: YYYY-MM-DD
const record = {
  date: '2026-01-15',
  // ...
};

// Convert to display format: MM/DD/YYYY
const displayDate = convertSupabaseToFileMaker(record.date);
// Result: '01/15/2026'
```

### 3. Validating User Input

```javascript
const userInput = document.getElementById('dateInput').value;

// Validate format and value
if (!isValidFileMakerDate(userInput)) {
  setError('Invalid date. Use MM/DD/YYYY format.');
  return;
}

// Safe to use
const apiDate = convertFileMakerToSupabase(userInput);
```

### 4. Handling Both Formats

```javascript
import { parseDate, formatDate, formatDateUS } from '../utils/dateUtils';

// Parse any format
const date1 = parseDate('2026-01-15');  // ISO
const date2 = parseDate('01/15/2026');  // FileMaker

// Format to Supabase (YYYY-MM-DD)
const isoDate = formatDate(date1);

// Format to FileMaker (MM/DD/YYYY)
const usDate = formatDateUS(date2);
```

## Function Cheat Sheet

| Function | Input | Output | Use Case |
|----------|-------|--------|----------|
| `convertFileMakerToSupabase()` | `'01/15/2026'` | `'2026-01-15'` | API calls |
| `convertSupabaseToFileMaker()` | `'2026-01-15'` | `'01/15/2026'` | Display |
| `isValidFileMakerDate()` | `'01/15/2026'` | `true` | Validation |
| `isValidSupabaseDate()` | `'2026-01-15'` | `true` | Validation |
| `parseDate()` | `'01/15/2026'` or `'2026-01-15'` | `Date` | Flexible parsing |
| `formatDate()` | `Date` or string | `'2026-01-15'` | Format to ISO |
| `formatDateUS()` | `Date` or string | `'01/15/2026'` | Format to US |

## Error Handling Pattern

```javascript
// Always check for null return
const converted = convertFileMakerToSupabase(userInput);

if (!converted) {
  // Invalid date - show error
  console.error('Date conversion failed');
  return;
}

// Safe to use
await apiCall({ date: converted });
```

## Common Mistakes to Avoid

❌ **Don't manually parse dates:**
```javascript
// Bad
const parts = date.split('/');
const isoDate = `${parts[2]}-${parts[0]}-${parts[1]}`;
```

✅ **Use the utility:**
```javascript
// Good
const isoDate = convertFileMakerToSupabase(date);
```

❌ **Don't assume format:**
```javascript
// Bad - might be ISO or US format
const date = new Date(dateString);
```

✅ **Parse explicitly:**
```javascript
// Good - handles both formats
const date = parseDate(dateString);
```

## Date Format Reference

| Format | Example | Use |
|--------|---------|-----|
| FileMaker/US | `01/15/2026` | User input, display |
| Supabase/ISO | `2026-01-15` | API calls, storage |

## Dependencies

Requires `date-fns` library:
```bash
npm install date-fns
```

## Full Documentation

See [DATE_UTILITIES.md](./DATE_UTILITIES.md) for complete documentation.
