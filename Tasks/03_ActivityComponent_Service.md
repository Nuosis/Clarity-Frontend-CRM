# Financial Activity Component Service Layer Implementation

## Task Description
Implement the service layer for the Financial Activity component to process and format financial data. This layer will handle business logic, data transformation, and provide a clean interface between the API and UI layers.

## Assigned To
Coder

## Dependencies
- Financial Activity component architecture design
- API layer implementation for financial records

## Expected Outcomes
1. Service functions for processing financial data
2. Data formatting and transformation utilities
3. Business logic implementation for financial analysis

## Technical Requirements

### Service Functions
Create a new file `src/services/financialService.js` with the following functions:
- `processFinancialData(data)`: Process raw financial data from FileMaker
- `formatFinancialRecordForDisplay(record)`: Format financial record data for display
- `groupRecordsByCustomer(records)`: Group records by customer for display
- `groupRecordsByProject(records, customerId)`: Group records by project for a specific customer
- `calculateTotals(records)`: Calculate total amounts for records
- `calculateMonthlyTotals(records)`: Calculate monthly totals for charting

### Data Processing
- Transform raw FileMaker data into a consistent format
- Handle different financial record types appropriately
- Ensure proper date and amount formatting
- Process customer and project information for display

### Business Logic
- Implement sorting logic for financial records
- Calculate unbilled hours and amounts
- Implement filtering logic by date ranges and payment status
- Ensure data consistency and validation
- Prepare data for chart visualizations

## Implementation Details

### Data Processing Structure
```javascript
/**
 * Processes raw financial data from FileMaker
 * @param {Object} data - Raw financial data from FileMaker
 * @returns {Array} Processed financial records
 */
export function processFinancialData(data) {
  if (!data?.response?.data) {
    return [];
  }

  return data.response.data.map(record => ({
    // Transformation logic
    id: record.fieldData.__ID,
    recordId: record.recordId, //used for delete and patch
    customerId: record.fieldData._customerID,
    projectId: record.fieldData._projectID,
    amount: parseFloat(record.fieldData.amount || 0),
    hours: parseFloat(record.fieldData.hours || 0),
    date: record.fieldData.DateStart,
    billed: record.fieldData.f_billed === "1" || record.fieldData.f_billed === 1,
    description: record.fieldData["Work Performed"] || "",
    // Additional fields
  }));
}
```

### Formatting Function
```javascript
/**
 * Formats financial record data for display
 * @param {Object} record - Financial record
 * @returns {Object} Formatted financial data
 */
export function formatFinancialRecordForDisplay(record) {
  return {
    id: record.id,
    amount: formatCurrency(record.amount),
    hours: formatHours(record.hours),
    date: formatDate(record.date),
    status: record.billed ? 'Billed' : 'Unbilled',
    description: record.description,
    // Additional formatted fields
  };
}
```

### Chart Data Preparation
```javascript
/**
 * Prepares data for chart visualization
 * @param {Array} records - Financial records
 * @param {string} chartType - Type of chart ("bar", "line", "stacked")
 * @returns {Object} Formatted chart data
 */
export function prepareChartData(records, chartType) {
  // Implementation based on chart type
}
```

### Integration with Existing Services
- Export functions from `src/services/index.js`
- Ensure compatibility with existing service patterns
- Follow established naming conventions and coding standards

## Deliverables
1. `src/services/financialService.js` file with implemented service functions
2. Updated `src/services/index.js` with exported functions
3. Documentation for the service functions
4. Unit tests for the service functions (if applicable)