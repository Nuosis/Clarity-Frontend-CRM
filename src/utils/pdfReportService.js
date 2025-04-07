/**
 * PDF Report Generation Service
 *
 * This file provides service functions to generate PDF reports using data
 * from any context, without depending on specific data sources.
 */
import { jsPDF } from 'jspdf';
import { generateProjectActivityReport, generateDetailedProjectReport } from './pdfReport';
import { ensureAutoTableAvailable, downloadPdf } from './pdfUtils';

// Ensure autoTable is available on the jsPDF prototype
ensureAutoTableAvailable();
import { generateProjectActivityReport, generateDetailedProjectReport } from './pdfReport';

/**
 * Generates a PDF report from activity records for a specific customer
 *
 * @param {Array|Object} records - Records from any source (can be raw API response or processed records)
 * @param {string} customerId - Customer ID to filter records (optional)
 * @param {Object} options - Report generation options
 * @returns {Object} Generated PDF report
 */
export async function generateCustomerProjectReport(records, customerId, options = {}) {
  try {
    // Extract the actual records array from the input
    // This handles both raw API responses and pre-processed records
    const recordsArray = records.response?.data || records;
    
    // Process the records directly without relying on financialService
    const processedRecords = processRecords(recordsArray);
    
    // Group the records by project
    const groupedByProject = groupByProject(processedRecords, customerId);
    
    // Set default options
    const defaultOptions = {
      title: customerId
        ? `Project Activity Report for Customer ${customerId}`
        : 'Project Activity Report',
      dateRange: getDateRangeFromRecords(processedRecords),
      fileName: 'customer-project-report.pdf'
    };
    
    // Generate the report
    return generateProjectActivityReport(groupedByProject, { ...defaultOptions, ...options });
  } catch (error) {
    console.error('Error generating customer project report:', error);
    throw new Error(`Failed to generate PDF report: ${error.message}`);
  }
}

/**
 * Process records from any source into a standardized format
 *
 * @param {Array} records - Records from any source
 * @returns {Array} Processed records in a standardized format
 */
function processRecords(records) {
  return records.map(record => {
    // Handle both raw FileMaker records and pre-processed records
    const fieldData = record.fieldData || record;
    
    // Extract or use existing fields
    return {
      id: fieldData.__ID || fieldData.id,
      recordId: record.recordId || fieldData.recordId,
      customerId: fieldData._custID || fieldData.customerId,
      customerName: fieldData["Customers::Name"] || fieldData.customerName,
      projectId: fieldData._projectID || fieldData.projectId,
      projectName: fieldData["customers_Projects::projectName"] || fieldData["customers_Projects::Name"] || fieldData.projectName,
      amount: fieldData.amount || calculateAmount(fieldData.Billable_Time_Rounded, fieldData.Hourly_Rate || fieldData["Customers::chargeRate"]),
      hours: parseFloat(fieldData.Billable_Time_Rounded || fieldData.hours || 0),
      rate: parseFloat(fieldData.Hourly_Rate || fieldData["Customers::chargeRate"] || fieldData.rate || 0),
      date: fieldData.DateStart || fieldData.date,
      month: parseInt(fieldData.month || 0),
      year: parseInt(fieldData.year || 0),
      billed: fieldData.f_billed === "1" || fieldData.f_billed === 1 || fieldData.billed === true,
      description: fieldData["Work Performed"] || fieldData.description || ""
    };
  });
}

/**
 * Calculate amount from hours and rate
 *
 * @param {string|number} hours - Hours value
 * @param {string|number} rate - Rate value
 * @returns {number} Calculated amount
 */
function calculateAmount(hours, rate) {
  const parsedHours = parseFloat(hours || 0);
  const parsedRate = parseFloat(rate || 0);
  return parsedHours * parsedRate;
}

/**
 * Group records by project
 *
 * @param {Array} records - Processed records
 * @param {string} customerId - Optional customer ID to filter by
 * @returns {Object} Records grouped by project
 */
function groupByProject(records, customerId) {
  // Filter by customer ID if provided
  const filteredRecords = customerId
    ? records.filter(record => record.customerId === customerId)
    : records;
    
  // Group by project
  return filteredRecords.reduce((grouped, record) => {
    const projectId = record.projectId;
    
    if (!grouped[projectId]) {
      grouped[projectId] = {
        projectId,
        projectName: record.projectName,
        customerName: record.customerName,
        totalHours: 0,
        totalAmount: 0,
        records: []
      };
    }
    
    grouped[projectId].records.push(record);
    grouped[projectId].totalAmount += record.amount;
    grouped[projectId].totalHours += record.hours;
    
    return grouped;
  }, {});
}

/**
 * Generates a detailed PDF report for a specific project
 *
 * @param {Array|Object} records - Records from any source (can be raw API response or processed records)
 * @param {string} projectId - Project ID to generate report for
 * @param {Object} options - Report generation options
 * @returns {Object} Generated PDF report
 */
export async function generateSingleProjectReport(records, projectId, options = {}) {
  try {
    // Extract the actual records array from the input
    // This handles both raw API responses and pre-processed records
    const recordsArray = records.response?.data || records;
    
    // Process the records directly without relying on financialService
    const processedRecords = processRecords(recordsArray);
    
    // Filter records for the specific project
    const projectRecords = processedRecords.filter(record => record.projectId === projectId);
    
    if (projectRecords.length === 0) {
      throw new Error(`No records found for project ID: ${projectId}`);
    }
    
    // Get project details from the first record
    const projectName = projectRecords[0].projectName;
    const customerName = projectRecords[0].customerName;
    
    // Calculate totals
    const totalHours = projectRecords.reduce((sum, record) => sum + record.hours, 0);
    const totalAmount = projectRecords.reduce((sum, record) => sum + record.amount, 0);
    
    // Create project data object
    const projectData = {
      projectId,
      projectName,
      customerName,
      totalHours,
      totalAmount,
      records: projectRecords
    };
    
    // Set default options
    const defaultOptions = {
      dateRange: getDateRangeFromRecords(projectRecords),
      fileName: `${projectName.replace(/\s+/g, '-').toLowerCase()}-report.pdf`
    };
    
    // Generate the detailed report
    return generateDetailedProjectReport(projectData, { ...defaultOptions, ...options });
  } catch (error) {
    console.error('Error generating single project report:', error);
    throw new Error(`Failed to generate PDF report: ${error.message}`);
  }
}

/**
 * Determines the date range from a set of financial records
 * 
 * @param {Array} records - Processed financial records
 * @returns {string} Formatted date range string
 */
function getDateRangeFromRecords(records) {
  if (!records || records.length === 0) {
    return 'No date range available';
  }
  
  // Extract dates and sort them
  const dates = records
    .map(record => record.date)
    .filter(date => date) // Remove null/undefined dates
    .map(date => new Date(date))
    .sort((a, b) => a - b);
  
  if (dates.length === 0) {
    return 'No date range available';
  }
  
  // Format the start and end dates
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  
  const formatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', formatOptions)} - ${endDate.toLocaleDateString('en-US', formatOptions)}`;
}

/**
 * Example usage in a component:
 *
 * // Example with financial records
 * import { useFinancialRecords } from '../hooks/useFinancialRecords';
 * import { generateCustomerProjectReport } from '../utils/pdfReportService';
 *
 * function FinancialReportButton({ customerId }) {
 *   const { financialRecords, loading } = useFinancialRecords();
 *
 *   const handleGenerateReport = async () => {
 *     if (loading || !financialRecords) return;
 *     
 *     try {
 *       const report = await generateCustomerProjectReport(
 *         { response: { data: financialRecords } },
 *         customerId,
 *         { includeBilled: true, includeUnbilled: true }
 *       );
 *       
 *       // Save the PDF file
 *       report.save();
 *     } catch (error) {
 *       console.error('Error generating report:', error);
 *       // Show error message to user
 *     }
 *   };
 *   
 *   return (
 *     <button 
 *       onClick={handleGenerateReport}
 *       disabled={loading}
 *       className="px-4 py-2 bg-primary text-white rounded-md"
 *     >
 *       Generate PDF Report
 *     </button>
 *   );
 * }
 *
 * // Example with customer activity records
 * import { generateCustomerProjectReport } from '../utils/pdfReportService';
 *
 * function ActivityReportButton({ customerId, activityData }) {
 *   const handleGenerateReport = async () => {
 *     if (!activityData || activityData.length === 0) return;
 *
 *     try {
 *       const report = await generateCustomerProjectReport(
 *         activityData,
 *         customerId,
 *         {
 *           title: `Activity Report for ${customerId}`,
 *           includeBilled: true,
 *           includeUnbilled: true
 *         }
 *       );
 *
 *       // Save the PDF file
 *       report.save();
 *     } catch (error) {
 *       console.error('Error generating activity report:', error);
 *       // Show error message to user
 *     }
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleGenerateReport}
 *       disabled={!activityData || activityData.length === 0}
 *       className="px-4 py-2 bg-primary text-white rounded-md"
 *     >
 *       Export Activity Report
 *     </button>
 *   );
 * }
 */