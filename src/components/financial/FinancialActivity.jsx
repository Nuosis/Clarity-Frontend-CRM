import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSalesActivity } from '../../hooks/useSalesActivity';
import { useAppState } from '../../context/AppStateContext';
import { executeQBOQuery } from '../../api/quickbooksEdgeFunction';
import { executeScript } from '../../api/fileMakerEdgeFunction';
import TimeframeSelector from './TimeframeSelector';
import FinancialChart from './FinancialChart';
import CustomerList from './CustomerList';
import CustomerSalesTable from './CustomerSalesTable';
import RecordModal from './RecordModal';

/**
 * Financial Activity component for displaying sales data
 * @param {Object} props - Component props
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Financial Activity component
 */
function FinancialActivity({ darkMode = false }) {
  // Local state for UI
  const [timeframe, setTimeframe] = useState('today');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [showFullCustomerList, setShowFullCustomerList] = useState(true);
  const [showQboTestPanel, setShowQboTestPanel] = useState(false);
  const [qboQueryResults, setQboQueryResults] = useState(null);
  const [isQboQueryLoading, setIsQboQueryLoading] = useState(false);
  const [qboQueryError, setQboQueryError] = useState(null);
  const [fmHealthResults, setFmHealthResults] = useState(null);
  const [isFmHealthLoading, setIsFmHealthLoading] = useState(false);
  const [fmHealthError, setFmHealthError] = useState(null);
  
  // Check if QBO test flag is enabled
  const isQboTestEnabled = import.meta.env.VITE_TEST_QB === 'true';

  // Use the sales activity hook
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
    saveSale,
    fetchData,
    updateInvoiceStatus
  } = useSalesActivity(timeframe);

  // Get the showFinancialActivity state from AppStateContext
  const { showFinancialActivity } = useAppState();
  
  // Clear selectedCustomer when Financial Activity is shown via Sidebar
  useEffect(() => {
    if (showFinancialActivity) {
      selectCustomer(null);
      setShowFullCustomerList(true);
    }
  }, [showFinancialActivity, selectCustomer]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((newTimeframe) => {
    setTimeframe(newTimeframe);
    changeTimeframe(newTimeframe);
  }, [changeTimeframe]);

  // Handle customer selection
  const handleCustomerSelect = useCallback((customerId) => {
    console.log("Customer selected:", customerId);
    console.log("Selected customer before update:", selectedCustomer);
    
    // Just update the customer selection - no need to refetch data
    selectCustomer(customerId);
    
    setShowFullCustomerList(false); // Hide the full customer list when a customer is selected
    console.log("Selected customer after update:", selectedCustomer);
  }, [selectCustomer, selectedCustomer]);
  
  // Handle back to customer list
  const handleBackToCustomerList = useCallback(() => {
    setShowFullCustomerList(true);
    selectCustomer(null);
  }, [selectCustomer]);

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
    await saveSale(updatedRecord);
    setIsEditModalOpen(false);
    fetchData();
  }, [saveSale, fetchData]);

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

  // Handle QBO test button click
  const handleQboTestClick = useCallback(() => {
    setShowQboTestPanel(prev => !prev);
    // Reset results when toggling the panel
    if (showQboTestPanel) {
      setQboQueryResults(null);
      setQboQueryError(null);
    }
  }, [showQboTestPanel]);
  
  // Execute QBO customer query
  const executeCustomerQuery = useCallback(async () => {
    setIsQboQueryLoading(true);
    setQboQueryError(null);
    setQboQueryResults(null);
    
    try {
      const query = "SELECT * FROM Customer MAXRESULTS 1000";
      const result = await executeQBOQuery(query);
      setQboQueryResults(result);
    } catch (error) {
      console.error("Error executing QBO query:", error);
      setQboQueryError(error.message || "Failed to execute QBO query");
    } finally {
      setIsQboQueryLoading(false);
    }
  }, []);
  
  // Reset all test results
  const resetTestResults = useCallback(() => {
    setQboQueryResults(null);
    setQboQueryError(null);
    setFmHealthResults(null);
    setFmHealthError(null);
  }, []);
  
  // Execute FileMaker health check script
  const executeFmHealthCheck = useCallback(async () => {
    setIsFmHealthLoading(true);
    setFmHealthError(null);
    setFmHealthResults(null);
    
    try {
      const layout = 'dapiRecordDetails';
      const scriptName = 'health';
      const result = await executeScript(layout, scriptName);
      setFmHealthResults(result);
    } catch (error) {
      console.error("Error executing FileMaker health check:", error);
      setFmHealthError(error.message || "Failed to execute FileMaker health check");
    } finally {
      setIsFmHealthLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col space-y-6" >
      {/* Header with timeframe selector and totals */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Financial Activity
          </h2>
          {!loading && totals && (
            <div className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Total: {formatCurrency(totals.totalAmount)}
            </div>
          )}
        </div>
        <TimeframeSelector 
          value={timeframe} 
          onChange={handleTimeframeChange} 
          darkMode={darkMode}
        />
      </div>
      
      {/* QBO Test Button - Only shown when test flag is enabled */}
      {isQboTestEnabled && (
        <div className={`
          p-4 rounded-lg border
          ${darkMode ? 'bg-purple-900 bg-opacity-30 border-purple-800' : 'bg-purple-50 border-purple-200'}
        `}>
          <div className="flex justify-between items-center">
            <h3 className={`font-medium ${darkMode ? 'text-purple-200' : 'text-purple-800'}`}>
              QuickBooks Online Testing
            </h3>
            <button
              onClick={handleQboTestClick}
              className={`
                text-xs px-2 py-1 rounded
                ${darkMode
                  ? 'bg-purple-800 text-purple-100 hover:bg-purple-700'
                  : 'bg-purple-100 text-purple-800 hover:bg-purple-200'}
              `}
            >
              {showQboTestPanel ? 'Hide QBO Test' : 'QBO Test'}
            </button>
          </div>
        </div>
      )}
      
      {/* QBO Test Panel */}
      {isQboTestEnabled && showQboTestPanel && (
        <div className={`
          p-4 rounded-lg border
          ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              QBO Customer Query Test
            </h3>
            
            {/* Reset Button - Only shown when there are results */}
            {(qboQueryResults || fmHealthResults || qboQueryError || fmHealthError) && (
              <button
                onClick={resetTestResults}
                className={`
                  text-xs px-2 py-1 rounded
                  ${darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                `}
              >
                Reset Results
              </button>
            )}
          </div>
          
          <div className="flex space-x-4 mb-4">
            {/* FileMaker Health Check Button */}
            <button
              onClick={executeFmHealthCheck}
              disabled={isFmHealthLoading}
              className={`
                px-4 py-2 rounded font-medium
                ${isFmHealthLoading
                  ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                  : (darkMode
                    ? 'bg-green-800 text-green-100 hover:bg-green-700'
                    : 'bg-green-600 text-white hover:bg-green-700')}
              `}
            >
              {isFmHealthLoading ? 'Loading...' : 'FileMaker Health Check'}
            </button>
            
            {/* QBO Customer Query Button */}
            <button
              onClick={executeCustomerQuery}
              disabled={isQboQueryLoading}
              className={`
                px-4 py-2 rounded font-medium
                ${isQboQueryLoading
                  ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                  : (darkMode
                    ? 'bg-blue-800 text-blue-100 hover:bg-blue-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700')}
              `}
            >
              {isQboQueryLoading ? 'Loading...' : 'Test Customer Query'}
            </button>
          </div>
          
          {qboQueryError && (
            <div className={`
              p-3 rounded-lg border mb-4
              ${darkMode ? 'bg-red-900 bg-opacity-30 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}
            `}>
              <p className="text-sm font-medium">Error executing query</p>
              <p className="text-xs mt-1">{qboQueryError}</p>
            </div>
          )}
          
          {/* FileMaker Health Check Results */}
          {fmHealthError && (
            <div className={`
              p-3 rounded-lg border mb-4
              ${darkMode ? 'bg-red-900 bg-opacity-30 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}
            `}>
              <p className="text-sm font-medium">Error executing FileMaker health check</p>
              <p className="text-xs mt-1">{fmHealthError}</p>
            </div>
          )}
          
          {fmHealthResults && (
            <div className={`
              p-3 rounded-lg border mb-4
              ${darkMode ? 'bg-green-900 bg-opacity-30 border-green-800' : 'bg-green-50 border-green-200'}
            `}>
              <h4 className={`font-medium mb-2 ${darkMode ? 'text-green-200' : 'text-green-800'}`}>
                FileMaker Health Check Results
              </h4>
              <div className={`
                p-3 rounded-lg border overflow-auto max-h-96
                ${darkMode ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}
              `} style={{ fontFamily: 'monospace' }}>
                <pre>{JSON.stringify(fmHealthResults, null, 2)}</pre>
              </div>
            </div>
          )}
          
          {/* QBO Query Results */}
          {qboQueryResults && (
            <div className={`
              p-3 rounded-lg border
              ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
            `}>
              <h4 className={`font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Query Results
              </h4>
              <div className={`
                p-3 rounded-lg border overflow-auto max-h-96
                ${darkMode ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}
              `} style={{ fontFamily: 'monospace' }}>
                <pre>{JSON.stringify(qboQueryResults, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
      
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
                {formatCurrency(selectedMonthRecords.reduce((sum, record) => sum + (record.total_price || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Chart area - only show when no customer is selected */}
      {showFullCustomerList && (
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
      )}
      
      {/* Customer list or Selected Customer Info */}
      <div className={`${!showFullCustomerList ? 'flex-grow overflow-hidden' : 'mb-6'}`} style={{ maxHeight: !showFullCustomerList ? 'calc(100vh - 15rem)' : 'auto' }}>
        {showFullCustomerList ? (
          <CustomerList
            customers={recordsByCustomer}
            projects={recordsByProject}
            selectedCustomerId={selectedCustomerId}
            onCustomerSelect={handleCustomerSelect}
            darkMode={darkMode}
            updateInvoiceStatus={updateInvoiceStatus}
          />
        ) : (
          <div className={`
            rounded-lg border overflow-hidden flex flex-col h-full
            ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          `}>
            <div className={`
              px-4 py-3 border-b flex justify-between items-center
              ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
            `}>
              <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Selected Customer
              </h3>
              <button
                onClick={handleBackToCustomerList}
                className={`
                  text-xs px-2 py-1 rounded
                  ${darkMode
                    ? 'bg-blue-800 text-blue-100 hover:bg-blue-700'
                    : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}
                `}
              >
                Back to Customer List
              </button>
            </div>
            
            {selectedCustomer && (
              <div className="p-4 grow overflow-auto">
                <div className="flex flex-col space-y-2">
                  <div className="text-lg font-medium mb-2">
                    {selectedCustomer.customerName}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Total Amount:
                      </span>
                      <div className={`text-base font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {formatCurrency(selectedCustomer.totalAmount)}
                      </div>
                    </div>
                    <div>
                      <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Total Units:
                      </span>
                      <div className={`text-base font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedCustomer.totalQuantity}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Display individual sales lines for the selected customer */}
                {selectedCustomer.records && selectedCustomer.records.length > 0 && (
                  <CustomerSalesTable
                    records={selectedCustomer.records}
                    onEditRecord={handleEditRecord}
                    darkMode={darkMode}
                    onRefresh={fetchData}
                  />
                )}
              </div>
            )}
          </div>
        )}
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