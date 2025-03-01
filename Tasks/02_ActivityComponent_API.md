# Financial Activity Component API Layer Implementation

## Task Description
Implement the API layer for the Financial Activity component to fetch financial data from FileMaker. This includes creating new API functions, handling errors, and ensuring proper integration with the existing API structure.

## Assigned To
Coder

## Dependencies
- Financial Activity component architecture design
- FileMaker database schema for financial records

## Expected Outcomes
1. New API functions for fetching financial data
2. Proper error handling and response formatting
3. Integration with the existing API structure

## Technical Requirements

### API Functions
Create a new file `src/api/financialRecords.js` with the following functions:
- `fetchFinancialRecords(timeframe, customerId, projectId)`: Fetch financial records based on timeframe and optional filters
- `fetchUnpaidRecords(customerId)`: Fetch unpaid financial records for a customer
- `fetchMonthlyRecords(month, year, customerId)`: Fetch records for a specific month
- `fetchQuarterlyRecords(quarter, year, customerId)`: Fetch records for a specific quarter
- `fetchYearlyRecords(year, customerId)`: Fetch records for a specific year

### Error Handling
- Implement proper error handling using the existing error handling patterns
- Use the `handleFileMakerOperation` wrapper for all FileMaker operations
- Format error responses consistently with the rest of the application

### Integration
- Export the new functions from `src/api/index.js`
- Ensure compatibility with the existing API structure
- Follow the established patterns for API function naming and parameter handling

### FileMaker Integration
- Use the appropriate FileMaker layouts for financial data (dapiRecords)
- Implement proper query parameters for filtering by date, customer, and payment status
- Follow the established patterns for FileMaker data fetching

## Implementation Details

### API Function Structure
```javascript
/**
 * Fetches financial records based on timeframe and optional filters
 * @param {string} timeframe - The timeframe to fetch ("thisMonth", "unpaid", "lastMonth", "thisQuarter", "thisYear")
 * @param {string} customerId - Optional customer ID to filter by
 * @param {string} projectId - Optional project ID to filter by
 * @returns {Promise} Promise resolving to the financial records data
 */
export async function fetchFinancialRecords(timeframe, customerId = null, projectId = null) {
  // Implementation details
}
```

### FileMaker Query Structure
```javascript
{
  layout: Layouts.RECORDS, // dapiRecords
  action: Actions.READ,
  query: [
    // For monthly data
    { "month": "2", "year": "2025" },
    
    // For unpaid records
    { "f_billed": 0 },
    
    // For customer-specific records
    { "_customerID": customerId }
  ]
}
```

## Deliverables
1. `src/api/financialRecords.js` file with implemented API functions
2. Updated `src/api/index.js` with exported functions
3. Documentation for the API functions
4. Unit tests for the API functions (if applicable)