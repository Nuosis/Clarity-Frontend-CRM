import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSalesActivity } from '../../hooks/useSalesActivity';
import { useAppState } from '../../context/AppStateContext';
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
    
    // Just update the customer selection - no need to refetch data
    selectCustomer(customerId);
    
    setShowFullCustomerList(false); // Hide the full customer list when a customer is selected
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