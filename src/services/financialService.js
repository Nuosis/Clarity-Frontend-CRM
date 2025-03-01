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

  return data.response.data.map(record => {
    // Extract field data for logging
    const fieldData = record.fieldData;
    const hourlyRate = fieldData.Hourly_Rate || fieldData["Customers::chargeRate"] || 0;
    const projectName = fieldData["customers_Projects::projectName"] || fieldData["customers_Projects::Name"] || "Unknown Project";
    
    // Log field mapping for debugging
    if (record === data.response.data[0]) {
      console.log("Field mapping for first record:", {
        id: fieldData.__ID,
        customerId: fieldData["customers_Projects::_custID"],
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
      customerId: fieldData["customers_Projects::_custID"],
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
  console.log(`Calculating amount: ${parsedHours} hours * ${parsedRate} rate = ${parsedHours * parsedRate}`);
  
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
  return records.reduce((grouped, record) => {
    const customerId = record.customerId;
    
    if (!grouped[customerId]) {
      grouped[customerId] = {
        customerId,
        customerName: record.customerName,
        records: [],
        totalAmount: 0,
        totalHours: 0,
        projects: {}
      };
    }
    
    grouped[customerId].records.push(record);
    grouped[customerId].totalAmount += record.amount;
    grouped[customerId].totalHours += record.hours;
    
    // Track projects within this customer
    const projectId = record.projectId;
    if (!grouped[customerId].projects[projectId]) {
      grouped[customerId].projects[projectId] = {
        projectId,
        projectName: record.projectName,
        records: [],
        totalAmount: 0,
        totalHours: 0
      };
    }
    
    grouped[customerId].projects[projectId].records.push(record);
    grouped[customerId].projects[projectId].totalAmount += record.amount;
    grouped[customerId].projects[projectId].totalHours += record.hours;
    
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
  const customerRecords = customerId 
    ? records.filter(record => record.customerId === customerId)
    : records;
    
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
 * @param {string} chartType - Type of chart ("bar", "line", "stacked")
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