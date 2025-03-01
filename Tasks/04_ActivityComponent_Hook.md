# Financial Activity Component Custom Hook Implementation

## Task Description
Implement a custom React hook for the Financial Activity component to manage financial data state. This hook will provide a clean interface for components to interact with financial records and handle loading, error, and state management.

## Assigned To
Coder

## Dependencies
- Financial Activity component architecture design
- Service layer implementation for financial records
- API layer implementation for financial records

## Expected Outcomes
1. Custom hook for managing financial data state
2. Loading and error state management
3. Data fetching and caching logic
4. Chart data preparation

## Technical Requirements

### Custom Hook
Create a new file `src/hooks/useFinancialRecords.js` with the following functionality:
- Fetch financial records based on timeframe and filters
- Manage loading and error states
- Handle filtering by customer, project, and date range
- Provide methods for data visualization preparation

### State Management
- Use React's useState and useEffect hooks for state management
- Implement proper loading state handling
- Implement error state management
- Handle data caching and refresh strategies

### Integration
- Export the hook from `src/hooks/index.js`
- Ensure compatibility with the existing hook patterns
- Follow established naming conventions and coding standards

## Implementation Details

### Hook Structure
```javascript
/**
 * Custom hook for managing financial record data
 * @param {string} timeframe - The timeframe to fetch ("thisMonth", "unpaid", "lastMonth", "thisQuarter", "thisYear")
 * @param {Object} options - Optional configuration options
 * @returns {Object} Financial data and methods
 */
export function useFinancialRecords(timeframe = "thisMonth", options = {}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(options.customerId || null);
  const [selectedProjectId, setSelectedProjectId] = useState(options.projectId || null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // Fetch records when dependencies change
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await financialService.fetchFinancialRecords(
          timeframe, 
          selectedCustomerId, 
          selectedProjectId
        );
        if (isMounted) {
          setRecords(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [timeframe, selectedCustomerId, selectedProjectId]);

  // Prepare chart data based on current records and timeframe
  const chartData = useMemo(() => {
    return financialService.prepareChartData(records, 
      timeframe === "thisQuarter" || timeframe === "thisYear" ? "line" : "stacked");
  }, [records, timeframe]);
  
  // Group records by customer
  const recordsByCustomer = useMemo(() => {
    return financialService.groupRecordsByCustomer(records);
  }, [records]);
  
  // Group records by project for selected customer
  const recordsByProject = useMemo(() => {
    if (!selectedCustomerId) return {};
    return financialService.groupRecordsByProject(records, selectedCustomerId);
  }, [records, selectedCustomerId]);
  
  // Calculate totals
  const totals = useMemo(() => {
    return financialService.calculateTotals(records);
  }, [records]);
  
  return {
    records,
    loading,
    error,
    chartData,
    recordsByCustomer,
    recordsByProject,
    totals,
    selectedCustomerId,
    setSelectedCustomerId,
    selectedProjectId,
    setSelectedProjectId,
    selectedMonth,
    setSelectedMonth,
    refreshRecords: () => fetchData(),
    // Additional methods
  };
}
```

### Additional Methods
- `setTimeframe(timeframe)`: Change the current timeframe
- `selectCustomer(customerId)`: Select a specific customer
- `selectProject(projectId)`: Select a specific project
- `selectMonth(month)`: Select a specific month (for quarterly/yearly views)

## Deliverables
1. `src/hooks/useFinancialRecords.js` file with implemented custom hook
2. Updated `src/hooks/index.js` with exported hook
3. Documentation for the custom hook
4. Unit tests for the custom hook (if applicable)