# Financial Records Aggregation RPC - Quick Reference Guide

**Created:** 2026-01-15
**Related Task:** TSK0008

---

## Overview

This guide provides quick examples for using the new Supabase aggregation RPCs for financial records. These functions provide pre-aggregated data from the database for better performance.

---

## Available Functions

### 1. Monthly Summary

**Function:** `fetchMonthlySummary(year, customerId = null)`

**Purpose:** Get aggregated financial data for each month of a year

**Parameters:**
- `year` (number, required): Year to query (e.g., 2026)
- `customerId` (string, optional): Filter by specific customer UUID

**Returns:** Array of monthly summaries
```javascript
[
  {
    month: 1,           // Month number (1-12)
    year: 2026,         // Year
    total_hours: 120.5, // Total billable hours
    total_amount: 18075.00,     // Total revenue
    billed_amount: 12000.00,    // Already invoiced
    unbilled_amount: 6075.00,   // Not yet invoiced
    record_count: 45    // Number of records
  },
  // ... more months (up to 12)
]
```

**Example Usage:**
```javascript
import { fetchMonthlySummary } from '../api/financialRecords';

// Get all months for current year
const currentYear = new Date().getFullYear();
const monthlySummary = await fetchMonthlySummary(currentYear);

// Get months for specific customer
const customerSummary = await fetchMonthlySummary(2026, 'customer-uuid-here');

// Transform for Chart.js
const chartData = {
  labels: monthlySummary.map(m => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m.month - 1]),
  datasets: [
    {
      label: 'Billed',
      data: monthlySummary.map(m => m.billed_amount),
      backgroundColor: 'rgba(75, 192, 192, 0.5)'
    },
    {
      label: 'Unbilled',
      data: monthlySummary.map(m => m.unbilled_amount),
      backgroundColor: 'rgba(255, 159, 64, 0.5)'
    }
  ]
};
```

---

### 2. Quarterly Summary

**Function:** `fetchQuarterlySummary(year, quarter, customerId = null)`

**Purpose:** Get aggregated financial data for a specific quarter

**Parameters:**
- `year` (number, required): Year to query
- `quarter` (number, required): Quarter number (1-4)
- `customerId` (string, optional): Filter by specific customer UUID

**Quarter Definitions:**
- Q1: January - March (months 1-3)
- Q2: April - June (months 4-6)
- Q3: July - September (months 7-9)
- Q4: October - December (months 10-12)

**Returns:** Array with single quarter summary
```javascript
[
  {
    quarter: 1,         // Quarter number (1-4)
    year: 2026,         // Year
    total_hours: 350.5, // Total billable hours
    total_amount: 52575.00,     // Total revenue
    billed_amount: 40000.00,    // Already invoiced
    unbilled_amount: 12575.00,  // Not yet invoiced
    record_count: 125   // Number of records
  }
]
```

**Example Usage:**
```javascript
import { fetchQuarterlySummary } from '../api/financialRecords';

// Get Q1 2026 summary
const q1Summary = await fetchQuarterlySummary(2026, 1);
console.log(`Q1 Revenue: $${q1Summary[0].total_amount}`);

// Get current quarter
const now = new Date();
const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
const currentYear = now.getFullYear();
const currentQuarterSummary = await fetchQuarterlySummary(currentYear, currentQuarter);

// Calculate billed percentage
const billedPercent = (q1Summary[0].billed_amount / q1Summary[0].total_amount) * 100;
console.log(`Billed: ${billedPercent.toFixed(1)}%`);
```

---

### 3. Yearly Summary

**Function:** `fetchYearlySummary(year, customerId = null)`

**Purpose:** Get aggregated financial data for an entire year

**Parameters:**
- `year` (number, required): Year to query
- `customerId` (string, optional): Filter by specific customer UUID

**Returns:** Array with single year summary
```javascript
[
  {
    year: 2026,          // Year
    total_hours: 1450.0, // Total billable hours
    total_amount: 217500.00,    // Total revenue
    billed_amount: 180000.00,   // Already invoiced
    unbilled_amount: 37500.00,  // Not yet invoiced
    record_count: 520    // Number of records
  }
]
```

**Example Usage:**
```javascript
import { fetchYearlySummary } from '../api/financialRecords';

// Get current year summary
const currentYear = new Date().getFullYear();
const yearlySummary = await fetchYearlySummary(currentYear);

// Get last 3 years for comparison
const years = [currentYear - 2, currentYear - 1, currentYear];
const yearlyData = await Promise.all(
  years.map(year => fetchYearlySummary(year))
);

// Compare year-over-year growth
const thisYear = yearlyData[2][0].total_amount;
const lastYear = yearlyData[1][0].total_amount;
const growth = ((thisYear - lastYear) / lastYear) * 100;
console.log(`YoY Growth: ${growth.toFixed(1)}%`);
```

---

## Error Handling

All functions throw errors if:
- Organization context is missing (user not authenticated)
- Organization ID is missing from JWT
- RPC call fails (network, permissions, etc.)
- Invalid parameters (e.g., quarter not 1-4)

**Example:**
```javascript
try {
  const summary = await fetchMonthlySummary(2026);
  console.log('Monthly summary:', summary);
} catch (error) {
  console.error('Failed to fetch monthly summary:', error);

  if (error.message.includes('Organization context is required')) {
    // User needs to sign in
    redirectToLogin();
  } else if (error.message.includes('Quarter must be between 1 and 4')) {
    // Invalid quarter parameter
    showError('Invalid quarter selected');
  } else {
    // Generic RPC error
    showError('Unable to load financial data');
  }
}
```

---

## Performance Comparison

### Client-Side Aggregation (Old Approach)
```javascript
// Fetch all records for the year
const records = await fetchFinancialRecords('thisYear');

// Aggregate in JavaScript
const monthlyTotals = {};
records.forEach(record => {
  const month = record.date.split('-')[1];
  if (!monthlyTotals[month]) {
    monthlyTotals[month] = { total: 0, billed: 0, unbilled: 0 };
  }
  monthlyTotals[month].total += record.total_price;
  if (record.inv_id) {
    monthlyTotals[month].billed += record.total_price;
  } else {
    monthlyTotals[month].unbilled += record.total_price;
  }
});

// Problem: Fetches 100s of records, processes in browser
```

### Server-Side Aggregation (New Approach)
```javascript
// Fetch pre-aggregated data
const monthlySummary = await fetchMonthlySummary(2026);

// Data already aggregated by database
// Returns only 12 rows (one per month)
// No client-side processing needed

// Benefit: 90%+ reduction in data transfer and processing
```

---

## Chart Integration

### Example: Monthly Revenue Chart with Billed/Unbilled Breakdown

```javascript
import { fetchMonthlySummary } from '../api/financialRecords';

async function loadMonthlyRevenueChart(year) {
  try {
    const monthlySummary = await fetchMonthlySummary(year);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const chartData = {
      labels: monthlySummary.map(m => monthNames[m.month - 1]),
      datasets: [
        {
          label: 'Billed',
          data: monthlySummary.map(m => m.billed_amount),
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: 'Unbilled',
          data: monthlySummary.map(m => m.unbilled_amount),
          backgroundColor: 'rgba(255, 159, 64, 0.5)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1
        }
      ],
      originalData: monthlySummary // For click handlers
    };

    // FinancialChart component will detect this as aggregated data
    // and automatically enable stacking
    return chartData;

  } catch (error) {
    console.error('Error loading chart:', error);
    throw error;
  }
}
```

---

## Common Use Cases

### 1. Dashboard Revenue Summary
```javascript
const currentYear = new Date().getFullYear();
const yearlySummary = await fetchYearlySummary(currentYear);

displayRevenueSummary({
  totalRevenue: yearlySummary[0].total_amount,
  billed: yearlySummary[0].billed_amount,
  unbilled: yearlySummary[0].unbilled_amount,
  hours: yearlySummary[0].total_hours
});
```

### 2. Customer Revenue Report
```javascript
const customerId = 'customer-uuid-here';
const monthlySummary = await fetchMonthlySummary(2026, customerId);

const totalCustomerRevenue = monthlySummary.reduce(
  (sum, month) => sum + month.total_amount,
  0
);

console.log(`Customer revenue in 2026: $${totalCustomerRevenue}`);
```

### 3. Unbilled Hours Alert
```javascript
const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
const quarterlySummary = await fetchQuarterlySummary(currentYear, currentQuarter);

const unbilledHours = quarterlySummary[0].total_hours -
                      (quarterlySummary[0].billed_amount / 150); // Assuming $150/hr

if (unbilledHours > 100) {
  alert(`Warning: ${unbilledHours} unbilled hours this quarter!`);
}
```

### 4. Year-Over-Year Comparison
```javascript
const years = [2024, 2025, 2026];
const yearlyComparison = await Promise.all(
  years.map(year => fetchYearlySummary(year))
);

const comparisonData = yearlyComparison.map((summary, index) => ({
  year: years[index],
  revenue: summary[0].total_amount,
  hours: summary[0].total_hours,
  avgRate: summary[0].total_amount / summary[0].total_hours
}));

console.table(comparisonData);
```

---

## Migration Guide (Future)

When updating `useSalesActivity` hook to use aggregation RPCs:

**Before:**
```javascript
// Client-side aggregation
const records = filterRecordsByTimeframe(stateSales, timeframe);
const monthlyData = calculateMonthlyTotals(records, timeframe);
```

**After:**
```javascript
// Server-side aggregation
const currentYear = new Date().getFullYear();
const monthlyData = await fetchMonthlySummary(currentYear);
```

**Benefits:**
- Faster loading (less data transfer)
- Less client-side processing
- Database-optimized aggregation
- Consistent with backend patterns

---

## Best Practices

1. **Cache Aggregated Data**
   - Results don't change frequently
   - Cache for 5-10 minutes to reduce RPC calls
   - Invalidate on record creation/update

2. **Error Boundaries**
   - Wrap RPC calls in try-catch
   - Provide fallback UI on error
   - Log errors for debugging

3. **Loading States**
   - Show loading indicator during RPC call
   - Disable actions while loading
   - Handle slow network gracefully

4. **Customer Filtering**
   - Use customer filter parameter instead of client-side filtering
   - Database performs filtering more efficiently
   - Reduces data transfer

---

## Troubleshooting

### "Organization context is required" Error
**Cause:** User not authenticated or organization_id missing from JWT
**Solution:** Ensure user is signed in and organization is selected

### "Failed to fetch monthly summary: RPC error"
**Cause:** Database RPC function error or permissions issue
**Solution:** Check Supabase logs, verify RLS policies allow access

### "Quarter must be between 1 and 4"
**Cause:** Invalid quarter parameter
**Solution:** Validate quarter input before calling function

### Empty Results Array
**Cause:** No records exist for the specified period
**Solution:** This is normal - handle gracefully in UI (show "No data" message)

---

## References

- **API Client:** `src/api/financialRecords.js`
- **Chart Component:** `src/components/financial/FinancialChart.jsx`
- **API Contracts:** `requirements/financial-records/api-contracts.md`
- **Task Completion:** `.devflow/tasks/financial-records-backend-integration/TSK0008_COMPLETION_SUMMARY.md`
