/**
 * Financial records data processing and business logic
 */

import { formatCurrency, formatDateTime, validateRequired } from './index';

/**
 * Processes raw financial data from FileMaker
 * @param {Object} data - Raw financial data from FileMaker
 * @returns {Array} Processed financial records
 */
export function processFinancialData(data) {
  if (!data?.response?.data) {
    console.error("processFinancialData: Missing data.response.data", data);
    return [];  }

  console.log("Processing financial data. First record sample:",
    data.response.data[0] ? JSON.stringify(data.response.data[0].fieldData, null, 2) : "No records");

  // Log customer IDs from the first few records to check for empty values
  const customerIdSamples = data.response.data.slice(0, 5).map(record => ({
    id: record.fieldData.__ID,
    customerId: record.fieldData["_custID"],
    customerName: record.fieldData["Customers::Name"]
  }));
  console.log("Customer ID samples from first 5 records:", customerIdSamples);

  // Count records with empty customer IDs
  const emptyCustomerIdCount = data.response.data.filter(record =>
    !record.fieldData["_custID"] || record.fieldData["_custID"] === ""
  ).length;
  console.log(`Records with empty customer IDs: ${emptyCustomerIdCount} out of ${data.response.data.length}`);

  return data.response.data.map(record => {
    // Extract field data for logging
    const fieldData = record.fieldData;
    const hourlyRate = fieldData.Hourly_Rate || fieldData["Customers::chargeRate"] || 0;
    const projectName = fieldData["customers_Projects::projectName"] || fieldData["customers_Projects::Name"] || "Unknown Project";
    
    // Log field mapping for debugging
    if (record === data.response.data[0]) {
      console.log("Field mapping for first record:", {
        id: fieldData.__ID,
        customerId: fieldData["_custID"],
        customerName: fieldData["Customers::Name"],
        projectId: fieldData._projectID,
        projectName: projectName,
        billableTime: fieldData.Billable_Time_Rounded,
        hourlyRate: hourlyRate,
        calculatedAmount: calculateAmount(fieldData.Billable_Time_Rounded, hourlyRate)
      });
    }
    
    return {
      id: fieldData.__ID,
      recordId: record.recordId, // used for delete and patch
      customerId: fieldData["_custID"],
      customerName: fieldData["Customers::Name"] || "Unknown Customer",
      projectId: fieldData._projectID,
      projectName: projectName,
      amount: calculateAmount(fieldData.Billable_Time_Rounded, hourlyRate),
      hours: parseFloat(fieldData.Billable_Time_Rounded || 0),
      rate: parseFloat(hourlyRate),
      date: fieldData.DateStart,
      month: parseInt(fieldData.month || 0),
      year: parseInt(fieldData.year || 0),
      billed: fieldData.f_billed === "1" || fieldData.f_billed === 1,
      description: fieldData["Work Performed"] || "",
      createdAt: fieldData['~creationTimestamp'],
      modifiedAt: fieldData['~ModificationTimestamp'] || fieldData['~modificationTimestamp']
    };
  });
}

/**
 * Calculates the financial amount based on hours and rate
 * @param {string|number} hours - Billable hours
 * @param {string|number} rate - Hourly rate
 * @returns {number} Calculated amount
 */
function calculateAmount(hours, rate) {
  const parsedHours = parseFloat(hours || 0);
  const parsedRate = parseFloat(rate || 0);
  
  // Log calculation for debugging
  // console.log(`Calculating amount: ${parsedHours} hours * ${parsedRate} rate = ${parsedHours * parsedRate}`);
  
  return parsedHours * parsedRate;
}

/**
 * Formats financial record data for display
 * @param {Object} record - Financial record
 * @returns {Object} Formatted financial data
 */
export function formatFinancialRecordForDisplay(record) {
  return {
    id: record.id,
    recordId: record.recordId,
    customerId: record.customerId,
    customerName: record.customerName,
    projectId: record.projectId,
    projectName: record.projectName,
    amount: formatCurrency(record.amount),
    rawAmount: record.amount, // Keep raw value for calculations
    hours: formatHours(record.hours),
    rawHours: record.hours, // Keep raw value for calculations
    rate: formatCurrency(record.rate),
    date: formatDate(record.date),
    rawDate: record.date, // Keep raw value for sorting
    month: record.month,
    year: record.year,
    status: record.billed ? 'Billed' : 'Unbilled',
    billed: record.billed,
    description: record.description,
    created: formatDateTime(record.createdAt),
    modified: formatDateTime(record.modifiedAt)
  };
}

/**
 * Formats hours for display
 * @param {number} hours - Hours value
 * @returns {string} Formatted hours
 */
function formatHours(hours) {
  return `${hours.toFixed(2)} hrs`;
}

/**
 * Formats date for display
 * @param {string} dateString - Date string from FileMaker
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Groups financial records by customer
 * @param {Array} records - Financial records
 * @returns {Object} Records grouped by customer
 */
export function groupRecordsByCustomer(records) {
  // Log records with empty customer IDs
  const recordsWithEmptyIds = records.filter(record => !record.customerId || record.customerId === "");
  console.log(`groupRecordsByCustomer: Found ${recordsWithEmptyIds.length} records with empty customer IDs`);
  
  if (recordsWithEmptyIds.length > 0) {
    console.log("Sample record with empty customer ID:", recordsWithEmptyIds[0]);
  }
  
  // Check for "Whiskey Creek Marine" records specifically
  const whiskeyCreekRecords = records.filter(record =>
    record.customerName && record.customerName.includes("Whiskey Creek")
  );
  console.log(`Found ${whiskeyCreekRecords.length} records for Whiskey Creek Marine`);
  
  if (whiskeyCreekRecords.length > 0) {
    console.log("First Whiskey Creek record:", whiskeyCreekRecords[0]);
  }

  return records.reduce((grouped, record) => {
    // Use customer name as the key if customer ID is empty
    // This ensures each customer gets their own entry even with empty IDs
    const groupKey = record.customerId || `name:${record.customerName}`;
    
    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        customerId: record.customerId,
        customerName: record.customerName,
        records: [],
        totalAmount: 0,
        totalHours: 0,
        projects: {}
      };
    }
    
    grouped[groupKey].records.push(record);
    grouped[groupKey].totalAmount += record.amount;
    grouped[groupKey].totalHours += record.hours;
    
    // Track projects within this customer
    const projectId = record.projectId;
    if (!grouped[groupKey].projects[projectId]) {
      grouped[groupKey].projects[projectId] = {
        projectId,
        projectName: record.projectName,
        records: [],
        totalAmount: 0,
        totalHours: 0
      };
    }
    
    grouped[groupKey].projects[projectId].records.push(record);
    grouped[groupKey].projects[projectId].totalAmount += record.amount;
    grouped[groupKey].projects[projectId].totalHours += record.hours;
    
    return grouped;
  }, {});
}

/**
 * Groups financial records by project for a specific customer
 * @param {Array} records - Financial records
 * @param {string} customerId - Customer ID to filter by
 * @returns {Object} Records grouped by project
 */
export function groupRecordsByProject(records, customerId) {
  console.log(`[DEBUG] groupRecordsByProject - Total records: ${records.length}, Customer ID: ${customerId}`);
  
  // Log billed vs unbilled counts
  const billedCount = records.filter(r => r.billed).length;
  const unbilledCount = records.filter(r => !r.billed).length;
  console.log(`[DEBUG] Records by billed status - Billed: ${billedCount}, Unbilled: ${unbilledCount}`);
  
  const customerRecords = customerId
    ? records.filter(record => record.customerId === customerId)
    : records;
  
  console.log(`[DEBUG] Records for customer ${customerId}: ${customerRecords.length}`);
    
  return customerRecords.reduce((grouped, record) => {
    const projectId = record.projectId;
    
    if (!grouped[projectId]) {
      grouped[projectId] = {
        projectId,
        projectName: record.projectName,
        customerId: record.customerId,
        customerName: record.customerName,
        records: [],
        totalAmount: 0,
        totalHours: 0
      };
    }
    
    grouped[projectId].records.push(record);
    grouped[projectId].totalAmount += record.amount;
    grouped[projectId].totalHours += record.hours;
    
    return grouped;
  }, {});
}

/**
 * Calculates total amounts for financial records
 * @param {Array} records - Financial records
 * @returns {Object} Calculated totals
 */
export function calculateTotals(records) {
  return records.reduce((totals, record) => {
    totals.totalAmount += record.amount;
    totals.totalHours += record.hours;
    
    if (record.billed) {
      totals.billedAmount += record.amount;
      totals.billedHours += record.hours;
    } else {
      totals.unbilledAmount += record.amount;
      totals.unbilledHours += record.hours;
    }
    
    return totals;
  }, {
    totalAmount: 0,
    totalHours: 0,
    billedAmount: 0,
    billedHours: 0,
    unbilledAmount: 0,
    unbilledHours: 0
  });
}

/**
 * Calculates monthly totals for charting
 * @param {Array} records - Financial records
 * @returns {Array} Monthly totals for charting
 */
export function calculateMonthlyTotals(records) {
  const monthlyData = {};
  
  // Initialize with empty data for all months to ensure continuous chart
  const allYears = [...new Set(records.map(record => record.year))].sort();
  
  if (allYears.length > 0) {
    for (const year of allYears) {
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${month.toString().padStart(2, '0')}`;
        monthlyData[key] = {
          year,
          month,
          totalAmount: 0,
          totalHours: 0,
          billedAmount: 0,
          unbilledAmount: 0,
          recordCount: 0,
          label: getMonthLabel(month, year)
        };
      }
    }
  }
  
  // Fill in actual data
  records.forEach(record => {
    if (record.month && record.year) {
      const key = `${record.year}-${record.month.toString().padStart(2, '0')}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = {
          year: record.year,
          month: record.month,
          totalAmount: 0,
          totalHours: 0,
          billedAmount: 0,
          unbilledAmount: 0,
          recordCount: 0,
          label: getMonthLabel(record.month, record.year)
        };
      }
      
      monthlyData[key].totalAmount += record.amount;
      monthlyData[key].totalHours += record.hours;
      monthlyData[key].recordCount += 1;
      
      if (record.billed) {
        monthlyData[key].billedAmount += record.amount;
      } else {
        monthlyData[key].unbilledAmount += record.amount;
      }
    }
  });
  
  // Convert to array and sort by date
  return Object.values(monthlyData).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

/**
 * Gets a formatted month label
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year
 * @returns {string} Formatted month label
 */
function getMonthLabel(month, year) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Prepares data for chart visualization
 * @param {Array} records - Financial records
 * @param {string} chartType - Type of chart ("bar", "line", "stacked", "quarterlyLine", "yearlyLine")
 * @returns {Object} Formatted chart data
 */
export function prepareChartData(records, chartType) {
  switch (chartType.toLowerCase()) {
    case 'bar': {
      // Simple bar chart showing total amounts by customer
      const customerGroups = groupRecordsByCustomer(records);
      
      return {
        labels: Object.values(customerGroups).map(group => group.customerName),
        datasets: [{
          label: 'Total Amount',
          data: Object.values(customerGroups).map(group => group.totalAmount),
          backgroundColor: 'rgba(54, 162, 235, 0.6)'
        }]
      };
    }
    
    case 'stacked': {
      // Stacked bar chart showing amounts by customer, segmented by project
      const customerGroups = groupRecordsByCustomer(records);
      const customers = Object.values(customerGroups);
      
      // Get all unique projects across all customers
      const allProjects = new Set();
      customers.forEach(customer => {
        Object.keys(customer.projects).forEach(projectId => {
          allProjects.add(projectId);
        });
      });
      
      // Create a dataset for each project
      const datasets = Array.from(allProjects).map((projectId, index) => {
        // Get a unique color for this project (simplified)
        const hue = (index * 137) % 360;
        const backgroundColor = `hsla(${hue}, 70%, 60%, 0.7)`;
        
        return {
          label: customers.find(c => c.projects[projectId])?.projects[projectId]?.projectName || `Project ${projectId}`,
          data: customers.map(customer => customer.projects[projectId]?.totalAmount || 0),
          backgroundColor
        };
      });
      
      return {
        labels: customers.map(customer => customer.customerName),
        datasets
      };
    }
    
    case 'line': {
      // Line chart showing monthly totals
      const monthlyData = calculateMonthlyTotals(records);
      
      return {
        labels: monthlyData.map(data => data.label),
        datasets: [
          {
            label: 'Total Amount',
            data: monthlyData.map(data => data.totalAmount),
            borderColor: 'rgba(54, 162, 235, 0.8)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Billed Amount',
            data: monthlyData.map(data => data.billedAmount),
            borderColor: 'rgba(75, 192, 192, 0.8)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Unbilled Amount',
            data: monthlyData.map(data => data.unbilledAmount),
            borderColor: 'rgba(255, 159, 64, 0.8)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      };
    }
    
    case 'quarterlyline': {
      // Line chart showing monthly totals for the last three completed months with comparison to last year
      const monthlyData = calculateMonthlyTotals(records);
      
      // Get current date info
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // 1-12
      const currentYear = currentDate.getFullYear();
      const lastYear = currentYear - 1;
      
      // Calculate the last three completed months
      const lastThreeMonths = [];
      for (let i = 1; i <= 3; i++) {
        let month = currentMonth - i;
        let year = currentYear;
        
        // Adjust for previous year if needed
        if (month <= 0) {
          month += 12;
          year -= 1;
        }
        
        lastThreeMonths.push({
          month,
          year
        });
      }
      
      // Sort months chronologically
      lastThreeMonths.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      
      console.log("Last three months:", JSON.stringify(lastThreeMonths));
      console.log("All monthly data:", JSON.stringify(monthlyData.map(d => ({ month: d.month, year: d.year, amount: d.totalAmount }))));
      
      // Filter data for the last three months this year
      const thisYearData = monthlyData.filter(data => {
        return lastThreeMonths.some(m =>
          m.month === data.month && m.year === data.year
        );
      });
      
      console.log("This year data:", JSON.stringify(thisYearData.map(d => ({ month: d.month, year: d.year, amount: d.totalAmount }))));
      
      // Filter data for the same three months last year
      const lastYearData = monthlyData.filter(data => {
        return lastThreeMonths.some(m =>
          m.month === data.month && data.year === m.year - 1
        );
      });
      
      console.log("Last year data:", JSON.stringify(lastYearData.map(d => ({ month: d.month, year: d.year, amount: d.totalAmount }))));
      
      // Create labels for the last three months
      const monthLabels = lastThreeMonths.map(m => {
        const date = new Date(m.year, m.month - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'short' });
      });
      
      return {
        labels: monthLabels,
        datasets: [
          {
            label: `This Year`,
            data: lastThreeMonths.map(m => {
              const monthData = thisYearData.find(data =>
                data.month === m.month && data.year === m.year
              );
              return monthData ? monthData.totalAmount : 0;
            }),
            borderColor: 'rgba(54, 162, 235, 0.8)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            fill: true,
            tension: 0.4
          },
          {
            label: `Last Year`,
            data: lastThreeMonths.map(m => {
              const monthData = lastYearData.find(data =>
                data.month === m.month && data.year === m.year - 1
              );
              return monthData ? monthData.totalAmount : 0;
            }),
            borderColor: 'rgba(75, 192, 192, 0.8)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4
          }
        ]
      };
    }
    
    case 'yearlyline': {
      // Line chart showing monthly totals for yearly view with financial year starting March 1
      const monthlyData = calculateMonthlyTotals(records);
      
      // Get current year and last year
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const lastYear = currentYear - 1;
      
      // Sort monthly data by financial year (March to February)
      const sortedMonthlyData = [...monthlyData].sort((a, b) => {
        // Adjust month to financial year (March = 1, February = 12)
        const getFinancialMonth = (month) => (month - 3 + 12) % 12 + 1;
        
        if (a.year !== b.year) return a.year - b.year;
        return getFinancialMonth(a.month) - getFinancialMonth(b.month);
      });
      
      // Filter data for current financial year (March 1 to Feb 28/29)
      const currentFinancialYearData = sortedMonthlyData.filter(data => {
        if (data.month >= 3 && data.year === currentYear) return true;
        if (data.month < 3 && data.year === currentYear + 1) return true;
        return false;
      });
      
      // Filter data for last financial year
      const lastFinancialYearData = sortedMonthlyData.filter(data => {
        if (data.month >= 3 && data.year === lastYear) return true;
        if (data.month < 3 && data.year === currentYear) return true;
        return false;
      });
      
      // Create labels for all months in the financial year
      const financialYearLabels = [];
      for (let i = 0; i < 12; i++) {
        const month = (i + 2) % 12 + 1; // Start from March (3)
        const year = month >= 3 ? currentYear : currentYear + 1;
        const date = new Date(year, month - 1, 1);
        financialYearLabels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      }
      
      // Create datasets for current and last financial years
      return {
        labels: financialYearLabels,
        datasets: [
          {
            label: `${currentYear}/${currentYear + 1}`,
            data: financialYearLabels.map((_, index) => {
              const month = (index + 2) % 12 + 1; // Start from March (3)
              const year = month >= 3 ? currentYear : currentYear + 1;
              const monthData = currentFinancialYearData.find(
                data => data.month === month && data.year === year
              );
              return monthData ? monthData.totalAmount : 0;
            }),
            borderColor: 'rgba(54, 162, 235, 0.8)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            fill: true,
            tension: 0.4
          },
          {
            label: `${lastYear}/${currentYear}`,
            data: financialYearLabels.map((_, index) => {
              const month = (index + 2) % 12 + 1; // Start from March (3)
              const year = month >= 3 ? lastYear : currentYear;
              const monthData = lastFinancialYearData.find(
                data => data.month === month && data.year === year
              );
              return monthData ? monthData.totalAmount : 0;
            }),
            borderColor: 'rgba(75, 192, 192, 0.8)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4
          }
        ]
      };
    }
    
    default:
      throw new Error(`Unsupported chart type: ${chartType}`);
  }
}

/**
 * Validates financial record data before creation/update
 * @param {Object} data - Financial record data to validate
 * @returns {Object} Validation result { isValid, errors }
 */
export function validateFinancialRecordData(data) {
  const errors = [];
  
  try {
    validateRequired(data, ['customerId', 'projectId', 'hours', 'rate', 'date']);
  } catch (error) {
    errors.push(error.message);
  }
  
  if (data.hours && (isNaN(parseFloat(data.hours)) || parseFloat(data.hours) < 0)) {
    errors.push('Hours must be a positive number');
  }
  
  if (data.rate && (isNaN(parseFloat(data.rate)) || parseFloat(data.rate) < 0)) {
    errors.push('Rate must be a positive number');
  }
  
  if (data.date && isNaN(new Date(data.date).getTime())) {
    errors.push('Invalid date format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Formats financial record data for FileMaker
 * @param {Object} data - Financial record data to format
 * @returns {Object} Formatted data for FileMaker
 */
export function formatFinancialRecordForFileMaker(data) {
  const date = new Date(data.date);
  
  return {
    _projectID: data.projectId,
    Billable_Time_Rounded: data.hours.toString(),
    Hourly_Rate: data.rate.toString(),
    DateStart: data.date,
    month: (date.getMonth() + 1).toString(),
    year: date.getFullYear().toString(),
    f_billed: data.billed ? "1" : "0",
    "Work Performed": data.description || ""
  };
}

/**
 * Sorts financial records by date
 * @param {Array} records - Financial records to sort
 * @param {string} direction - Sort direction ('asc' or 'desc')
 * @returns {Array} Sorted records
 */
export function sortRecordsByDate(records, direction = 'desc') {
  return [...records].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return direction === 'asc' ? dateA - dateB : dateB - dateA;
  });
}

/**
 * Sorts financial records by amount
 * @param {Array} records - Financial records to sort
 * @param {string} direction - Sort direction ('asc' or 'desc')
 * @returns {Array} Sorted records
 */
export function sortRecordsByAmount(records, direction = 'desc') {
  return [...records].sort((a, b) => {
    return direction === 'asc' ? a.amount - b.amount : b.amount - a.amount;
  });
}

/**
 * Filters financial records by date range
 * @param {Array} records - Financial records to filter
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered records
 */
export function filterRecordsByDateRange(records, startDate, endDate) {
  return records.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= startDate && recordDate <= endDate;
  });
}

/**
 * Filters financial records by billed status
 * @param {Array} records - Financial records to filter
 * @param {boolean} billed - Billed status to filter by
 * @returns {Array} Filtered records
 */
export function filterRecordsByBilledStatus(records, billed) {
  return records.filter(record => record.billed === billed);
}