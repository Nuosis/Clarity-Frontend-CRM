/**
 * Utils module index file
 * 
 * This file exports all utility functions from the utils directory
 * to make them easier to import from other parts of the application.
 */

// Export PDF report generation functions
export { 
  generateProjectActivityReport,
  generateDetailedProjectReport
} from './pdfReport';

// Export PDF report service functions
export {
  generateCustomerProjectReport,
  generateSingleProjectReport
} from '../services/pdfReportService';

// Export PDF report example functions
export {
  generateExampleReport,
  generateReportFromAppData,
  generateReportFromFinancialRecords
} from './pdfReportExample';