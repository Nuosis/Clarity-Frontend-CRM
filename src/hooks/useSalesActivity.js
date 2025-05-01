import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../context/AppStateContext';
import { calculateSalesStats } from '../services/salesService';

/**
 * Hook for managing sales activity data and operations
 * @param {string} initialTimeframe - Initial timeframe to use
 * @returns {Object} Sales activity data and operations
 */
export function useSalesActivity(initialTimeframe = 'today') {
  const { sales: stateSales, user } = useAppState();
  
  // Local state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [records, setRecords] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [recordsByCustomer, setRecordsByCustomer] = useState([]);
  const [recordsByProject, setRecordsByProject] = useState([]);
  const [totals, setTotals] = useState({ totalAmount: 0, totalQuantity: 0 });
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedMonthRecords, setSelectedMonthRecords] = useState([]);
  const [monthlyTotals, setMonthlyTotals] = useState([]);

  // Process sales data when it changes or timeframe changes
  useEffect(() => {
    if (!stateSales || !Array.isArray(stateSales)) {
      setLoading(false);
      setError('No sales data available');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Filter records based on timeframe
      const filteredRecords = filterRecordsByTimeframe(stateSales, timeframe);
      setRecords(filteredRecords);

      // Calculate totals
      const calculatedTotals = calculateTotals(filteredRecords);
      setTotals(calculatedTotals);

      // Group records by customer
      const customerRecords = groupRecordsByCustomer(filteredRecords);
      setRecordsByCustomer(customerRecords);

      // Group records by project
      const projectRecords = groupRecordsByProject(filteredRecords);
      setRecordsByProject(projectRecords);

      // Prepare chart data
      const preparedChartData = prepareChartData(filteredRecords, timeframe);
      setChartData(preparedChartData);

      // Calculate monthly totals for quarterly/yearly views
      if (timeframe === 'thisQuarter' || timeframe === 'thisYear') {
        const monthlyData = calculateMonthlyTotals(filteredRecords, timeframe);
        setMonthlyTotals(monthlyData);
      }

      // Reset selections when timeframe changes
      setSelectedCustomerId(null);
      setSelectedCustomer(null);
      setSelectedProjectId(null);
      setSelectedProject(null);
      setSelectedMonth(null);
      setSelectedMonthRecords([]);
    } catch (err) {
      console.error('Error processing sales data:', err);
      setError(`Error processing sales data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [stateSales, timeframe]);

  // Update selected customer when selectedCustomerId changes
  useEffect(() => {
    if (selectedCustomerId && recordsByCustomer.length > 0) {
      const customer = recordsByCustomer.find(c => c.customerId === selectedCustomerId);
      setSelectedCustomer(customer || null);
    } else {
      setSelectedCustomer(null);
    }
  }, [selectedCustomerId, recordsByCustomer]);

  // Update selected project when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId && recordsByProject.length > 0) {
      const project = recordsByProject.find(p => p.projectId === selectedProjectId);
      setSelectedProject(project || null);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, recordsByProject]);

  // Update selected month records when selectedMonth changes
  useEffect(() => {
    if (selectedMonth && records.length > 0) {
      const { year, month } = selectedMonth;
      const monthRecords = records.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getFullYear() === year && recordDate.getMonth() + 1 === month;
      });
      setSelectedMonthRecords(monthRecords);
    } else {
      setSelectedMonthRecords([]);
    }
  }, [selectedMonth, records]);

  /**
   * Filter records based on timeframe
   * @param {Array} records - Records to filter
   * @param {string} timeframe - Timeframe to filter by
   * @returns {Array} Filtered records
   */
  const filterRecordsByTimeframe = (records, timeframe) => {
    const now = new Date();
    // Format today's date as YYYY-MM-DD for string comparison
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    console.log('Filtering records by timeframe:', timeframe);
    console.log('Today string format:', todayStr);
    console.log('Total records before filtering:', records.length);
    
    const filteredRecords = records.filter(record => {
      // For direct string comparison with date format YYYY-MM-DD
      const recordDateStr = record.date;
      // Also create a Date object for range comparisons
      const recordDate = new Date(record.date + 'T00:00:00'); // Add time to ensure consistent parsing
      
      switch (timeframe) {
        case 'today':
          const result = recordDateStr === todayStr;
          console.log(`Record date: ${recordDateStr}, matches today (${todayStr}): ${result}`);
          return result;
        
        case 'thisWeek': {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)
          
          // Format as YYYY-MM-DD for comparison
          const startOfWeekStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
          const endOfWeekStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getDate()).padStart(2, '0')}`;
          
          return recordDateStr >= startOfWeekStr && recordDateStr <= endOfWeekStr;
        }
        
        case 'thisMonth': {
          // Format as YYYY-MM for month comparison
          const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          return recordDateStr.startsWith(thisMonthStr);
        }
        
        case 'thisQuarter': {
          const quarter = Math.floor(now.getMonth() / 3);
          const startMonth = quarter * 3;
          const endMonth = startMonth + 2;
          
          // Format year for comparison
          const yearStr = `${now.getFullYear()}`;
          
          // Check if the record's month is within the current quarter
          const recordMonth = parseInt(recordDateStr.split('-')[1], 10) - 1; // 0-based month
          return recordDateStr.startsWith(yearStr) &&
                 recordMonth >= startMonth &&
                 recordMonth <= endMonth;
        }
        
        case 'thisYear': {
          // Format as YYYY for year comparison
          const thisYearStr = `${now.getFullYear()}`;
          return recordDateStr.startsWith(thisYearStr);
        }
        
        default:
          return true;
      }
    });
    
    console.log('Filtered records count:', filteredRecords.length);
    return filteredRecords;
  };

  /**
   * Calculate totals from records
   * @param {Array} records - Records to calculate totals from
   * @returns {Object} Totals object
   */
  const calculateTotals = (records) => {
    return records.reduce((acc, record) => {
      return {
        totalAmount: acc.totalAmount + (record.total_price || 0),
        totalQuantity: acc.totalQuantity + (record.quantity || 0)
      };
    }, { totalAmount: 0, totalQuantity: 0 });
  };

  /**
   * Group records by customer
   * @param {Array} records - Records to group
   * @returns {Array} Records grouped by customer
   */
  const groupRecordsByCustomer = (records) => {
    const customerMap = new Map();
    
    records.forEach(record => {
      const customerId = record.customer_id;
      if (!customerId) return;
      
      if (!customerMap.has(customerId)) {
        // Get customer name from the customers object if available
        const customerName = record.customers?.business_name || 'Unknown Customer';
        
        customerMap.set(customerId, {
          customerId,
          customerName,
          records: [],
          totalAmount: 0,
          totalQuantity: 0,
          projects: new Set()
        });
      }
      
      const customer = customerMap.get(customerId);
      customer.records.push(record);
      customer.totalAmount += (record.total_price || 0);
      customer.totalQuantity += (record.quantity || 0);
      
      if (record.project_id) {
        customer.projects.add(record.project_id);
      }
    });
    
    // Convert to array and sort by total amount
    return Array.from(customerMap.values())
      .map(customer => ({
        ...customer,
        projects: Array.from(customer.projects)
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  };

  /**
   * Group records by project
   * @param {Array} records - Records to group
   * @returns {Array} Records grouped by project
   */
  const groupRecordsByProject = (records) => {
    const projectMap = new Map();
    
    records.forEach(record => {
      const projectId = record.project_id;
      if (!projectId) return;
      
      if (!projectMap.has(projectId)) {
        // Get customer name from the customers object if available
        const customerName = record.customers?.business_name || 'Unknown Customer';
        
        projectMap.set(projectId, {
          projectId,
          projectName: record.project_name || 'Unknown Project',
          customerId: record.customer_id,
          customerName,
          records: [],
          totalAmount: 0,
          totalQuantity: 0
        });
      }
      
      const project = projectMap.get(projectId);
      project.records.push(record);
      project.totalAmount += (record.total_price || 0);
      project.totalQuantity += (record.quantity || 0);
    });
    
    // Filter projects by selected customer if any
    let projectsArray = Array.from(projectMap.values());
    
    if (selectedCustomerId) {
      projectsArray = projectsArray.filter(project => project.customerId === selectedCustomerId);
    }
    
    // Sort by total amount
    return projectsArray.sort((a, b) => b.totalAmount - a.totalAmount);
  };

  /**
   * Prepare chart data based on timeframe
   * @param {Array} records - Records to prepare chart data from
   * @param {string} timeframe - Timeframe to prepare chart data for
   * @returns {Object} Chart data
   */
  const prepareChartData = (records, timeframe) => {
    if (!records || records.length === 0) {
      return {
        labels: [],
        datasets: [
          {
            label: 'Sales',
            data: [],
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }
        ]
      };
    }
    
    let labels = [];
    let data = [];
    
    switch (timeframe) {
      case 'today': {
        // Group by hour
        const hourlyData = new Array(24).fill(0);
        
        // For today's data, we need to check if the date matches today's date
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        records.forEach(record => {
          // Only process records from today
          if (record.date === todayStr) {
            // Since we only have the date (not time) in the sales data,
            // we'll assign all sales to the current hour for visualization
            const currentHour = now.getHours();
            hourlyData[currentHour] += (record.total_price || 0);
          }
        });
        
        labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        data = hourlyData;
        break;
      }
      
      case 'thisWeek': {
        // Group by day of week
        const dailyData = new Array(7).fill(0);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Get current week's date range
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        
        records.forEach(record => {
          // Parse the record date
          const [year, month, day] = record.date.split('-').map(num => parseInt(num, 10));
          const recordDate = new Date(year, month - 1, day); // month is 0-indexed in JS Date
          
          // Calculate day of week (0-6, where 0 is Sunday)
          const dayOfWeek = recordDate.getDay();
          
          // Check if the record is from the current week
          const recordTime = recordDate.getTime();
          const startOfWeekTime = startOfWeek.getTime();
          const endOfWeekTime = startOfWeekTime + (6 * 24 * 60 * 60 * 1000); // 6 days in milliseconds
          
          if (recordTime >= startOfWeekTime && recordTime <= endOfWeekTime) {
            dailyData[dayOfWeek] += (record.total_price || 0);
          }
        });
        
        labels = dayNames;
        data = dailyData;
        break;
      }
      
      case 'thisMonth': {
        // Group by day of month
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dailyData = new Array(daysInMonth).fill(0);
        
        // Format current month as YYYY-MM for comparison
        const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        records.forEach(record => {
          // Check if record is from current month
          if (record.date.startsWith(thisMonthStr)) {
            // Extract day from date (format: YYYY-MM-DD)
            const day = parseInt(record.date.split('-')[2], 10);
            if (day >= 1 && day <= daysInMonth) {
              dailyData[day - 1] += (record.total_price || 0);
            }
          }
        });
        
        labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
        data = dailyData;
        break;
      }
      
      case 'thisQuarter':
      case 'thisYear': {
        // Group by month
        const now = new Date();
        const currentYear = now.getFullYear();
        const startMonth = timeframe === 'thisQuarter'
          ? Math.floor(now.getMonth() / 3) * 3
          : 0;
        const monthCount = timeframe === 'thisQuarter' ? 3 : 12;
        const monthlyData = new Array(monthCount).fill(0);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        records.forEach(record => {
          // Check if record is from current year
          if (record.date.startsWith(`${currentYear}`)) {
            // Extract month from date (format: YYYY-MM-DD)
            const month = parseInt(record.date.split('-')[1], 10) - 1; // Convert to 0-indexed
            
            // Check if month is in the current quarter/year range
            const monthIndex = month - startMonth;
            if (monthIndex >= 0 && monthIndex < monthCount) {
              monthlyData[monthIndex] += (record.total_price || 0);
            }
          }
        });
        
        labels = monthNames.slice(startMonth, startMonth + monthCount);
        data = monthlyData;
        break;
      }
      
      default:
        break;
    }
    
    return {
      labels,
      datasets: [
        {
          label: 'Sales',
          data,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }
      ]
    };
  };

  /**
   * Calculate monthly totals for quarterly/yearly views
   * @param {Array} records - Records to calculate monthly totals from
   * @param {string} timeframe - Timeframe to calculate monthly totals for
   * @returns {Array} Monthly totals
   */
  const calculateMonthlyTotals = (records, timeframe) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startMonth = timeframe === 'thisQuarter'
      ? Math.floor(now.getMonth() / 3) * 3
      : 0;
    const monthCount = timeframe === 'thisQuarter' ? 3 : 12;
    const monthlyData = [];
    
    // Initialize monthly data
    for (let i = 0; i < monthCount; i++) {
      const month = startMonth + i + 1; // 1-based month
      monthlyData.push({
        year: currentYear,
        month,
        totalAmount: 0,
        totalQuantity: 0,
        records: []
      });
    }
    
    console.log('Calculating monthly totals for timeframe:', timeframe);
    console.log('Start month:', startMonth + 1, 'Month count:', monthCount);
    
    // Populate monthly data
    records.forEach(record => {
      // Check if record is from current year
      if (record.date.startsWith(`${currentYear}`)) {
        // Extract month from date (format: YYYY-MM-DD)
        const month = parseInt(record.date.split('-')[1], 10); // Already 1-based
        
        // Check if month is in the current quarter/year range
        const monthIndex = month - startMonth - 1;
        if (monthIndex >= 0 && monthIndex < monthCount) {
          monthlyData[monthIndex].totalAmount += (record.total_price || 0);
          monthlyData[monthIndex].totalQuantity += (record.quantity || 0);
          monthlyData[monthIndex].records.push(record);
        }
      }
    });
    
    // Log the results for debugging
    monthlyData.forEach((data, index) => {
      console.log(`Month ${data.month}: ${data.records.length} records, $${data.totalAmount}`);
    });
    
    return monthlyData;
  };

  /**
   * Change timeframe
   * @param {string} newTimeframe - New timeframe to set
   */
  const changeTimeframe = useCallback((newTimeframe) => {
    setTimeframe(newTimeframe);
  }, []);

  /**
   * Select a customer
   * @param {string} customerId - Customer ID to select
   */
  const selectCustomer = useCallback((customerId) => {
    setSelectedCustomerId(customerId);
    setSelectedProjectId(null);
  }, []);

  /**
   * Select a project
   * @param {string} projectId - Project ID to select
   */
  const selectProject = useCallback((projectId) => {
    setSelectedProjectId(projectId);
  }, []);

  /**
   * Select a month (for quarterly/yearly views)
   * @param {Object} monthData - Month data to select
   */
  const selectMonth = useCallback((monthData) => {
    setSelectedMonth(monthData);
  }, []);

  /**
   * Update invoice status for a sale
   * @param {string} saleId - Sale ID to update
   * @param {boolean} invoiced - Whether the sale is invoiced
   */
  const updateInvoiceStatus = useCallback(async (saleId, invoiced) => {
    try {
      // This would typically call a service function to update the sale
      console.log(`Updating invoice status for sale ${saleId} to ${invoiced}`);
      
      // For now, just update the local state
      setRecords(prevRecords => 
        prevRecords.map(record => 
          record.id === saleId
            ? { ...record, inv_id: invoiced ? 'pending' : null }
            : record
        )
      );
      
      return { success: true };
    } catch (err) {
      console.error('Error updating invoice status:', err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Save a sale record
   * @param {Object} saleData - Sale data to save
   */
  const saveSale = useCallback(async (saleData) => {
    try {
      // This would typically call a service function to save the sale
      console.log('Saving sale:', saleData);
      
      // For now, just update the local state
      if (saleData.id) {
        // Update existing sale
        setRecords(prevRecords => 
          prevRecords.map(record => 
            record.id === saleData.id
              ? { ...record, ...saleData }
              : record
          )
        );
      } else {
        // Create new sale
        const newSale = {
          ...saleData,
          id: `temp-${Date.now()}`, // Temporary ID
          date: new Date().toISOString().split('T')[0]
        };
        setRecords(prevRecords => [...prevRecords, newSale]);
      }
      
      return { success: true };
    } catch (err) {
      console.error('Error saving sale:', err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Fetch data (refresh)
   */
  const fetchData = useCallback(() => {
    // This would typically call a service function to fetch fresh data
    console.log('Fetching fresh sales data');
    
    // For now, just trigger a re-render by changing the timeframe and back
    const currentTimeframe = timeframe;
    setTimeframe('temp');
    setTimeout(() => setTimeframe(currentTimeframe), 0);
  }, [timeframe]);

  return {
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
  };
}