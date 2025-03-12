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
   * Fetches financial records based on current timeframe
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      console.log(`Fetching financial records for timeframe: ${timeframe}`);
      
      // Fetch all records for the timeframe without customer or project filter
      const data = await fetchFinancialRecords(timeframe);
      
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
      setProcessedRecords(sortedData); // Store all processed data
      setError(null);
    } catch (err) {
      console.error('Error fetching financial records:', err);
      setError(err.message || 'Failed to fetch financial records');
    } finally {
      setLoading(false);
    }
  }, [timeframe, sortConfig]); // Remove selectedCustomerId and selectedProjectId dependencies

  // Fetch records when timeframe changes
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
  }, [timeframe, options.autoLoad]); // Only depend on timeframe, not selectedCustomerId or selectedProjectId

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
    console.log(`Selecting customer: ${customerId}`);
    setSelectedCustomerId(customerId);
    // Reset project selection when changing customer
    setSelectedProjectId(null);
    // No need to refetch data, we'll filter the existing records
  }, []);

  /**
   * Selects a project and updates the state
   * @param {string} projectId - The project ID to select
   */
  const selectProject = useCallback((projectId) => {
    console.log(`Selecting project: ${projectId}`);
    setSelectedProjectId(projectId);
    // No need to refetch data, we'll filter the existing records
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

  /**
   * Optimistically updates the billed status of records
   * @param {string} customerId - The customer ID
   * @param {Array} recordIds - Array of record IDs to mark as billed
   * @returns {boolean} Success status
   */
  const updateBilledStatus = useCallback((customerId, recordIds) => {
    if (!customerId || !recordIds || recordIds.length === 0) {
      return false;
    }

    setProcessedRecords(prevRecords => {
      return prevRecords.map(record => {
        // If this record belongs to the customer and is in the recordIds array
        if (record.customerId === customerId && recordIds.includes(record.id)) {
          return {
            ...record,
            billed: true
          };
        }
        return record;
      });
    });

    return true;
  }, []);

  // Memoized derived data
  
  /**
   * Filtered records based on selected customer and project
   */
  const filteredRecords = useMemo(() => {
    let filtered = [...processedRecords];
    
    // Filter by customer if one is selected
    if (selectedCustomerId) {
      filtered = filtered.filter(record => record.customerId === selectedCustomerId);
    }
    
    // Filter by project if one is selected
    if (selectedProjectId) {
      filtered = filtered.filter(record => record.projectId === selectedProjectId);
    }
    
    return filtered;
  }, [processedRecords, selectedCustomerId, selectedProjectId]);
  
  /**
   * Chart data based on filtered records and timeframe
   */
  const chartData = useMemo(() => {
    let chartType;
    
    if (timeframe === "thisquarter") {
      chartType = "quarterlyline";
    } else if (timeframe === "thisyear") {
      chartType = "yearlyline";
    } else {
      // For today, thisweek, thismonth, lastmonth, and unpaid
      chartType = "stacked";
    }
    
    return financialService.prepareChartData(filteredRecords, chartType);
  }, [filteredRecords, timeframe]);

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
    
    console.log(`[DEBUG] Timeframe: ${timeframe}, Records count before filtering: ${processedRecords.length}`);
    
    // Log the first few records to see their structure and if they match the timeframe
    if (processedRecords.length > 0) {
      console.log('[DEBUG] Sample record:', JSON.stringify(processedRecords[0], null, 2));
    }
    
    // Check if we have any records with billed status matching the timeframe
    if (timeframe === 'unpaid') {
      const unbilledCount = processedRecords.filter(r => !r.billed).length;
      console.log(`[DEBUG] Unbilled records: ${unbilledCount} out of ${processedRecords.length}`);
    }
    
    // Get projects for the selected customer
    const projects = financialService.groupRecordsByProject(processedRecords, selectedCustomerId);
    
    console.log(`[DEBUG] Projects count for customer ${selectedCustomerId}: ${Object.keys(projects).length}`);
    
    return projects;
  }, [processedRecords, selectedCustomerId, timeframe]);
  
  /**
   * Calculate totals for filtered records
   */
  const totals = useMemo(() => {
    return financialService.calculateTotals(filteredRecords);
  }, [filteredRecords]);
  
  /**
   * Monthly totals for charting
   */
  const monthlyTotals = useMemo(() => {
    return financialService.calculateMonthlyTotals(filteredRecords);
  }, [filteredRecords]);
  
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
    
    return filteredRecords.filter(record =>
      record.month === selectedMonth.month &&
      record.year === selectedMonth.year
    );
  }, [filteredRecords, selectedMonth]);

  return {
    // Data
    records: filteredRecords, // Use filtered records as the primary records
    allRecords: processedRecords, // All processed records before filtering
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
    updateBilledStatus,
    
    // Aliases for more intuitive API
    setTimeframe: changeTimeframe,
    setSelectedCustomerId: selectCustomer,
    setSelectedProjectId: selectProject,
    setSelectedMonth: selectMonth,
    refreshRecords: fetchData
  };
}