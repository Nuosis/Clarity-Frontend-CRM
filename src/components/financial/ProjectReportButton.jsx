import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { generateCustomerProjectReport, generateSingleProjectReport } from '../../utils/pdfReportService';
import { downloadPdf } from '../../utils/pdfUtils';

/**
 * Button component for generating PDF reports for projects
 * 
 * @param {Object} props - Component props
 * @param {string} props.customerId - Customer ID (optional)
 * @param {string} props.projectId - Project ID (optional)
 * @param {Array} props.financialRecords - Financial records data
 * @param {Function} props.onSuccess - Callback function when report is generated successfully
 * @param {Function} props.onError - Callback function when an error occurs
 */
function ProjectReportButton({
  customerId,
  projectId,
  financialRecords,
  onSuccess,
  onError,
  className,
  children
}) {
  const [loading, setLoading] = useState(false);

  /**
   * Handles the generation of a PDF report
   */
  const handleGenerateReport = async () => {
    if (loading || !financialRecords) return;
    
    setLoading(true);
    
    try {
      // Prepare the financial records in the format expected by the report generator
      const formattedRecords = {
        response: {
          data: financialRecords
        }
      };
      
      let report;
      
      // Generate either a single project report or a customer projects report
      if (projectId) {
        report = await generateSingleProjectReport(
          formattedRecords,
          projectId,
          {
            includeBilled: true,
            includeUnbilled: true,
            orientation: 'landscape'
          }
        );
      } else {
        report = await generateCustomerProjectReport(
          formattedRecords,
          customerId,
          {
            includeBilled: true,
            includeUnbilled: true
          }
        );
      }
      
      // Download the PDF using the utility function
      await downloadPdf(report);
      
      // Call the success callback
      if (onSuccess) {
        onSuccess(report);
      }
    } catch (error) {
      console.error('Error generating PDF report:', error);
      
      // Call the error callback
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGenerateReport}
      disabled={loading}
      className={`px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50 ${className || ''}`}
      aria-label="Generate PDF Report"
    >
      {loading ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Generating...
        </span>
      ) : (
        children || 'Generate PDF Report'
      )}
    </button>
  );
}

ProjectReportButton.propTypes = {
  customerId: PropTypes.string,
  projectId: PropTypes.string,
  financialRecords: PropTypes.array.isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  className: PropTypes.string,
  children: PropTypes.node
};

export default ProjectReportButton;