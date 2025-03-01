import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useFinancialRecords } from '../../hooks/useFinancialRecords';
import TimeframeSelector from './TimeframeSelector';
import FinancialChart from './FinancialChart';
import CustomerList from './CustomerList';
import ProjectList from './ProjectList';
import RecordModal from './RecordModal';

/**
 * Financial Activity component for displaying financial data
 * @param {Object} props - Component props
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Financial Activity component
 */
function FinancialActivity({ darkMode = false }) {
  // Local state for UI
  const [timeframe, setTimeframe] = useState('thisMonth');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);

  // Use the financial records hook
  const { 
    records,
    loading, 
    error,
    chartData,
    recordsByCustomer,
    recordsByProject,
    totals,
    selectedCustomerId,
    selectedCustomer,
    selectedProjectId,
    selectedProject,
    selectedMonth,
    selectedMonthRecords,
    monthlyTotals,
    changeTimeframe,
    selectCustomer,
    selectProject,
    selectMonth,
    saveRecord,
    fetchData
  } = useFinancialRecords(timeframe);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((newTimeframe) => {
    setTimeframe(newTimeframe);
    changeTimeframe(newTimeframe);
  }, [changeTimeframe]);

  // Handle customer selection
  const handleCustomerSelect = useCallback((customerId) => {
    selectCustomer(customerId);
  }, [selectCustomer]);

  // Handle project selection
  const handleProjectSelect = useCallback((projectId) => {
    selectProject(projectId);
  }, [selectProject]);

  // Handle chart month click
  const handleChartMonthClick = useCallback((monthData) => {
    selectMonth(monthData);
  }, [selectMonth]);

  // Handle edit record
  const handleEditRecord = useCallback((record) => {
    setRecordToEdit(record);
    setIsEditModalOpen(true);
  }, []);

  // Handle save record
  const handleSaveRecord = useCallback(async (updatedRecord) => {
    await saveRecord(updatedRecord);
    setIsEditModalOpen(false);
    fetchData();
  }, [saveRecord, fetchData]);

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(amount);
  };

  // Format hours for display
  const formatHours = (hours) => {
    return `${hours.toFixed(2)} hrs`;
  };

  // Prepare chart data with original data for click handling
  const preparedChartData = React.useMemo(() => {
    if (!chartData || !chartData.labels) return null;
    
    return {
      ...chartData,
      originalData: timeframe === 'thisQuarter' || timeframe === 'thisYear' 
        ? monthlyTotals 
        : null
    };
  }, [chartData, monthlyTotals, timeframe]);

  return (
    <div className="space-y-6">
      {/* Header with timeframe selector and totals */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Financial Activity
          </h2>
          {!loading && totals && (
            <div className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Total: {formatCurrency(totals.totalAmount)} ({formatHours(totals.totalHours)})
            </div>
          )}
        </div>
        <TimeframeSelector 
          value={timeframe} 
          onChange={handleTimeframeChange} 
          darkMode={darkMode}
        />
      </div>
      
      {/* Error message */}
      {error && (
        <div className={`
          p-4 rounded-lg border
          ${darkMode ? 'bg-red-900 bg-opacity-30 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}
        `}>
          <p className="text-sm font-medium">Error loading financial data</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      )}
      
      {/* Selected month details (when a month is clicked in quarterly/yearly view) */}
      {selectedMonth && (
        <div className={`
          p-4 rounded-lg border
          ${darkMode ? 'bg-blue-900 bg-opacity-20 border-blue-800' : 'bg-blue-50 border-blue-200'}
        `}>
          <div className="flex justify-between items-center">
            <h3 className={`font-medium ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
              {new Date(selectedMonth.year, selectedMonth.month - 1).toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </h3>
            <button
              onClick={() => selectMonth(null)}
              className={`
                text-xs px-2 py-1 rounded
                ${darkMode 
                  ? 'bg-blue-800 text-blue-100 hover:bg-blue-700' 
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}
              `}
            >
              Clear Selection
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Records:</span>{' '}
              <span className={darkMode ? 'text-white' : 'text-gray-900'}>
                {selectedMonthRecords.length}
              </span>
            </div>
            <div>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Total:</span>{' '}
              <span className={darkMode ? 'text-white' : 'text-gray-900'}>
                {formatCurrency(selectedMonthRecords.reduce((sum, record) => sum + record.amount, 0))}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Chart area */}
      <div className={`
        p-4 rounded-lg border
        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
              Loading chart data...
            </p>
          </div>
        ) : records.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
              No financial data available for the selected timeframe
            </p>
          </div>
        ) : (
          <FinancialChart 
            data={preparedChartData}
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
      {isEditModalOpen && recordToEdit && (
        <RecordModal 
          record={recordToEdit}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveRecord}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

FinancialActivity.propTypes = {
  darkMode: PropTypes.bool
};

export default React.memo(FinancialActivity);