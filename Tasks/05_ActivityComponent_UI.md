# Financial Activity Component UI Implementation

## Task Description
Implement the UI components for the Financial Activity feature, creating a reusable component that can display financial data with charts, customer lists, and project breakdowns with filtering capabilities.

## Assigned To
Coder

## Dependencies
- Financial Activity component architecture design
- Custom hook implementation for financial records
- Service layer implementation for financial records
- API layer implementation for financial records

## Expected Outcomes
1. Reusable Financial Activity component
2. Chart visualization components
3. Customer and project list components
4. Filtering and timeframe selection UI
5. Integration with the application's design system

## Technical Requirements

### Component Structure
Create the following components:
- `src/components/financial/FinancialActivity.jsx`: Main container component
- `src/components/financial/FinancialChart.jsx`: Chart visualization component
- `src/components/financial/CustomerList.jsx`: Customer list component
- `src/components/financial/ProjectList.jsx`: Project list component
- `src/components/financial/TimeframeSelector.jsx`: Timeframe selection dropdown
- `src/components/financial/RecordModal.jsx`: Modal for editing records

### UI Features
- Display financial data in chart format (stacked bar or line chart based on timeframe)
- Support different timeframe selections (This Month, Unpaid, Last Month, This Quarter, This Year)
- Implement customer list with sorting capabilities
- Support project breakdown for selected customers
- Include record editing functionality
- Provide responsive design for different screen sizes

### Integration with Design System
- Use the application's color scheme and typography
- Implement responsive design for different screen sizes
- Follow accessibility best practices
- Support dark/light mode theming

## Implementation Details

### FinancialActivity Component
```jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useFinancialRecords } from '../../hooks/useFinancialRecords';
import { useTheme } from '../layout/AppLayout';
import FinancialChart from './FinancialChart';
import CustomerList from './CustomerList';
import ProjectList from './ProjectList';
import TimeframeSelector from './TimeframeSelector';
import RecordModal from './RecordModal';

function FinancialActivity() {
  const { darkMode } = useTheme();
  const [timeframe, setTimeframe] = useState('thisMonth');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  
  const { 
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
    setSelectedMonth
  } = useFinancialRecords(timeframe);
  
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
  };
  
  const handleCustomerSelect = (customerId) => {
    setSelectedCustomerId(customerId);
  };
  
  const handleProjectSelect = (projectId) => {
    setSelectedProjectId(projectId);
  };
  
  const handleChartMonthClick = (month) => {
    setSelectedMonth(month);
  };
  
  const handleEditRecord = (record) => {
    setRecordToEdit(record);
    setIsEditModalOpen(true);
  };
  
  return (
    <div className="space-y-6">
      {/* Header with timeframe selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Financial Activity</h2>
        <TimeframeSelector 
          value={timeframe} 
          onChange={handleTimeframeChange} 
          darkMode={darkMode}
        />
      </div>
      
      {/* Chart area */}
      <div className={`
        p-4 rounded-lg border
        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">Loading chart data...</p>
          </div>
        ) : (
          <FinancialChart 
            data={chartData}
            timeframe={timeframe}
            onMonthClick={handleChartMonthClick}
            darkMode={darkMode}
          />
        )}
      </div>
      
      {/* Customer and project lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer list */}
        <div className="lg:col-span-1">
          <CustomerList 
            customers={recordsByCustomer}
            selectedCustomerId={selectedCustomerId}
            onCustomerSelect={handleCustomerSelect}
            darkMode={darkMode}
          />
        </div>
        
        {/* Project list */}
        <div className="lg:col-span-2">
          {selectedCustomerId ? (
            <ProjectList 
              projects={recordsByProject}
              selectedProjectId={selectedProjectId}
              onProjectSelect={handleProjectSelect}
              onEditRecord={handleEditRecord}
              darkMode={darkMode}
            />
          ) : (
            <div className={`
              p-6 rounded-lg border text-center
              ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}
            `}>
              Select a customer to view projects
            </div>
          )}
        </div>
      </div>
      
      {/* Edit modal */}
      {isEditModalOpen && (
        <RecordModal 
          record={recordToEdit}
          onClose={() => setIsEditModalOpen(false)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

export default React.memo(FinancialActivity);
```

### Chart Component
```jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Bar, Line } from 'react-chartjs-2';

function FinancialChart({ data, timeframe, onMonthClick, darkMode }) {
  // Chart implementation based on timeframe
  const isLineChart = timeframe === 'thisQuarter' || timeframe === 'thisYear';
  
  // Chart configuration
  const chartConfig = {
    // Chart.js configuration
  };
  
  return (
    <div className="h-64">
      {isLineChart ? (
        <Line 
          data={data} 
          options={chartConfig} 
          onClick={(event, elements) => {
            if (elements.length > 0) {
              const index = elements[0].index;
              onMonthClick(data.labels[index]);
            }
          }}
        />
      ) : (
        <Bar 
          data={data} 
          options={chartConfig} 
        />
      )}
    </div>
  );
}

FinancialChart.propTypes = {
  data: PropTypes.object.isRequired,
  timeframe: PropTypes.string.isRequired,
  onMonthClick: PropTypes.func.isRequired,
  darkMode: PropTypes.bool.isRequired
};

export default React.memo(FinancialChart);
```

### Integration Points
- Add FinancialActivity to appropriate parent components
- Ensure proper prop passing and error handling
- Implement responsive design considerations

## Deliverables
1. Financial Activity component files in `src/components/financial/`
2. Integration with parent components
3. Documentation for the components
4. Unit tests for the components (if applicable)