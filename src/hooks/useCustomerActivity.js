import { useState, useCallback } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { 
  fetchCustomerActivityData, 
  processActivityData, 
  formatActivityRecordForDisplay 
} from '../api/customerActivity';

/**
 * Custom hook for managing customer activity data
 * @returns {Object} Activity data state and functions
 */
export function useCustomerActivity() {
  const { showError } = useSnackBar();
  const [activityData, setActivityData] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityTimeframe, setActivityTimeframe] = useState('unbilled');
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });

  /**
   * Fetch activity data for a customer
   * @param {Object} customer - Customer object with id
   * @returns {Promise<void>}
   */
  const fetchActivity = useCallback(async (customer) => {
    if (!customer || !customer.id) {
      showError('Customer information is missing');
      return;
    }

    // Prevent duplicate fetches if already loading
    if (loadingActivity) {
      return;
    }

    setLoadingActivity(true);
    try {
      // Map UI timeframe to API timeframe
      let apiTimeframe;
      if (activityTimeframe === 'unbilled') {
        apiTimeframe = 'unbilled';
      } else if (activityTimeframe === 'lastMonth') {
        apiTimeframe = 'lastmonth';
      } else if (activityTimeframe === 'custom') {
        apiTimeframe = 'custom';
      }
      
      // Fetch activity data using the dedicated function
      const data = await fetchCustomerActivityData(
        apiTimeframe,
        customer.id,
        activityTimeframe === 'custom' ? customDateRange : null
      );
      
      // Process the raw data
      const processedData = processActivityData(data || []);
      
      // Format records for display
      const formattedRecords = processedData.map(record =>
        formatActivityRecordForDisplay(record)
      );
      
      setActivityData(formattedRecords);
    } catch (error) {
      console.error('Error fetching activity data:', error);
      showError(`Error loading activity data: ${error.message}`);
      setActivityData([]);
    } finally {
      setLoadingActivity(false);
    }
  }, [activityTimeframe, customDateRange, showError, loadingActivity]);

  /**
   * Process activity data for report generation
   * @returns {Object} Processed data grouped by project
   */
  const processDataForReport = useCallback(() => {
    const processedData = {};
    
    // Group by project
    activityData.forEach(record => {
      const projectId = record.projectId;
      if (!processedData[projectId]) {
        processedData[projectId] = {
          projectId,
          projectName: record.projectName,
          totalHours: 0,
          totalAmount: 0,
          records: []
        };
      }
      
      // Create a modified record with numeric hours and amount
      const modifiedRecord = {
        ...record,
        hours: record.rawHours,
        amount: record.rawAmount
      };
      
      processedData[projectId].records.push(modifiedRecord);
      processedData[projectId].totalAmount += record.rawAmount;
      processedData[projectId].totalHours += record.rawHours;
    });
    
    return processedData;
  }, [activityData]);

  return {
    activityData,
    loadingActivity,
    activityTimeframe,
    setActivityTimeframe,
    customDateRange,
    setCustomDateRange,
    fetchActivity,
    processDataForReport
  };
}