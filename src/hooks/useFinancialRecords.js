import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchFinancialRecords } from '../api/financialRecords';
import * as financialService from '../services/financialService';

/**
 * Custom hook for managing financial record data
 * @param {string} initialTimeframe - The timeframe to fetch ("thisMonth", "unpaid", "lastMonth", "thisQuarter", "thisYear")
 * @param {Object} options - Optional configuration options
 * @param {string} options.customerId - Initial customer ID to filter by
 * @param {string} options.projectId - Initial project ID to filter by
 * @param {boolean} options.autoLoad - Whether to load data automatically (default: true)
 * @returns {Object} Financial data and methods
 */
export function useFinancialRecords(initialTimeframe = "thisMonth", options = {}) {
  // State for records and filters
  const [records, setRecords] = useState([]);
  const [processedRecords, setProcessedRecords] = useState([]);
  const [loading, setLoading] = useState(options.autoLoad !== false);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState(initialTimeframe.toLowerCase());
  
  // Selection states
  const [selectedCustomerId, setSelectedCustomerId] = useState(options.customerId || null);
  const [selectedProjectId, setSelectedProjectId] = useState(options.projectId || null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({
    field: 'date',
    direction: 'desc'
  });

  /**
   * Fetches financial records based on current filters
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      console.log(`Fetching financial records for timeframe: ${timeframe}`);
      const data = await fetchFinancialRecords(
        timeframe,
        selectedCustomerId,
        selectedProjectId
      );
      
      console.log("Raw FileMaker response structure:",
        JSON.stringify({
          hasResponse: !!data?.response,
          dataCount: data?.response?.data?.length || 0,
          dataInfo: data?.response?.dataInfo
        }, null, 2)
      );
      
      // Process the raw data using the service
      const processedData = financialService.processFinancialData(data);
      console.log(`Processed ${processedData.length} records`);
      
      if (processedData.length > 0) {
        console.log("First processed record sample:", JSON.stringify(processedData[0], null, 2));
      }
      
      // Apply sorting
      let sortedData = processedData;
      if (sortConfig.field === 'date') {
        sortedData = financialService.sortRecordsByDate(processedData, sortConfig.direction);
      } else if (sortConfig.field === 'amount') {
        sortedData = financialService.sortRecordsByAmount(processedData, sortConfig.direction);
      }
      
      setRecords(data); // Store raw data
      setProcessedRecords(sortedData); // Store processed data
      setError(null);
    } catch (err) {
      console.error('Error fetching financial records:', err);
      setError(err.message || 'Failed to fetch financial records');
    } finally {
      setLoading(false);
    }
  }, [timeframe, selectedCustomerId, selectedProjectId, sortConfig]);

  // Fetch records when dependencies change
  useEffect(() => {
    let isMounted = true;
    
    if (options.autoLoad !== false) {
      const loadData = async () => {
        try {
          await fetchData();
        } catch (err) {
          if (isMounted) {
            console.error('Error in useEffect data loading:', err);
          }
        }
      };
      
      loadData();
    }
    
    return () => {
      isMounted = false;
    };
  }, [fetchData, options.autoLoad]);

  /**
   * Changes the current timeframe and refetches data
   * @param {string} newTimeframe - The new timeframe to set
   */
  const changeTimeframe = useCallback((newTimeframe) => {
    setTimeframe(newTimeframe.toLowerCase());
    // Reset selected month when changing timeframe
    setSelectedMonth(null);
  }, []);

  /**
   * Selects a customer and updates the state
   * @param {string} customerId - The customer ID to select
   */
  const selectCustomer = useCallback((customerId) => {
    setSelectedCustomerId(customerId);
    // Reset project selection when changing customer
    setSelectedProjectId(null);
  }, []);

  /**
   * Selects a project and updates the state
   * @param {string} projectId - The project ID to select
   */
  const selectProject = useCallback((projectId) => {
    setSelectedProjectId(projectId);
  }, []);

  /**
   * Selects a month (for quarterly/yearly views) and updates the state
   * @param {Object} monthData - The month data object to select
   */
  const selectMonth = useCallback((monthData) => {
    setSelectedMonth(monthData);
  }, []);

  /**
   * Opens the edit modal for a specific record
   * @param {Object} record - The record to edit
   */
  const openEditModal = useCallback((record) => {
    setRecordToEdit(record);
    setIsEditModalOpen(true);
  }, []);

  /**
   * Closes the edit modal
   */
  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setRecordToEdit(null);
  }, []);

  /**
   * Saves changes to a record and refreshes data
   * @param {Object} updatedRecord - The updated record data
   */
  const saveRecord = useCallback(async (updatedRecord) => {
    try {
      // Format record for FileMaker
      const formattedRecord = financialService.formatFinancialRecordForFileMaker(updatedRecord);
      
      // TODO: Implement API call to update record
      // This would typically call an API function like updateFinancialRecord
      
      // Close modal and refresh data
      closeEditModal();
      await fetchData();
      
      return true;
    } catch (err) {
      setError(err.message || 'Failed to save record');
      return false;
    }
  }, [closeEditModal, fetchData]);

  /**
   * Updates the sort configuration
   * @param {string} field - The field to sort by
   */
  const updateSort = useCallback((field) => {
    setSortConfig(prevConfig => {
      if (prevConfig.field === field) {
        // Toggle direction if same field
        return {
          ...prevConfig,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc'
        };
      } else {
        // New field, default to descending for dates and amounts
        return {
          field,
          direction: field === 'date' || field === 'amount' ? 'desc' : 'asc'
        };
      }
    });
  }, []);

  // Memoized derived data
  
  /**
   * Chart data based on current records and timeframe
   */
  const chartData = useMemo(() => {
    const chartType = timeframe === "thisQuarter" || timeframe === "thisYear" 
      ? "line" 
      : "stacked";
    
    return financialService.prepareChartData(processedRecords, chartType);
  }, [processedRecords, timeframe]);
  
  /**
   * Records grouped by customer
   */
  const recordsByCustomer = useMemo(() => {
    return financialService.groupRecordsByCustomer(processedRecords);
  }, [processedRecords]);
  
  /**
   * Records grouped by project for selected customer
   */
  const recordsByProject = useMemo(() => {
    if (!selectedCustomerId) return {};
    return financialService.groupRecordsByProject(processedRecords, selectedCustomerId);
  }, [processedRecords, selectedCustomerId]);
  
  /**
   * Calculate totals for all records
   */
  const totals = useMemo(() => {
    return financialService.calculateTotals(processedRecords);
  }, [processedRecords]);
  
  /**
   * Monthly totals for charting
   */
  const monthlyTotals = useMemo(() => {
    return financialService.calculateMonthlyTotals(processedRecords);
  }, [processedRecords]);
  
  /**
   * Selected customer data
   */
  const selectedCustomer = useMemo(() => {
    return selectedCustomerId ? recordsByCustomer[selectedCustomerId] : null;
  }, [recordsByCustomer, selectedCustomerId]);
  
  /**
   * Selected project data
   */
  const selectedProject = useMemo(() => {
    return selectedProjectId && recordsByProject[selectedProjectId] 
      ? recordsByProject[selectedProjectId] 
      : null;
  }, [recordsByProject, selectedProjectId]);
  
  /**
   * Records for the selected month (when viewing quarterly/yearly data)
   */
  const selectedMonthRecords = useMemo(() => {
    if (!selectedMonth) return [];
    
    return processedRecords.filter(record => 
      record.month === selectedMonth.month && 
      record.year === selectedMonth.year
    );
  }, [processedRecords, selectedMonth]);

  return {
    // Data
    records: processedRecords,
    rawRecords: records,
    loading,
    error,
    timeframe,
    chartData,
    recordsByCustomer,
    recordsByProject,
    totals,
    monthlyTotals,
    
    // Selection state
    selectedCustomerId,
    selectedCustomer,
    selectedProjectId,
    selectedProject,
    selectedMonth,
    selectedMonthRecords,
    
    // Modal state
    isEditModalOpen,
    recordToEdit,
    
    // Sort state
    sortConfig,
    
    // Actions
    fetchData,
    changeTimeframe,
    selectCustomer,
    selectProject,
    selectMonth,
    openEditModal,
    closeEditModal,
    saveRecord,
    updateSort,
    
    // Aliases for more intuitive API
    setTimeframe: changeTimeframe,
    setSelectedCustomerId: selectCustomer,
    setSelectedProjectId: selectProject,
    setSelectedMonth: selectMonth,
    refreshRecords: fetchData
  };
}