import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppState } from '../../context/AppStateContext';
import { useSnackBar } from '../../context/SnackBarContext';
import { useCustomerActivity } from '../../hooks/useCustomerActivity';
import { sendEmailWithAttachment, isMailjetConfigured, createHtmlEmailTemplate, isValidEmail } from '../../services/mailjetService';
import RecordModal from '../financial/RecordModal';
import { updateActivityRecord } from '../../api/customerActivity';

// Helper function to send PDF to FileMaker
function sendToFileMaker(base64Data, fileName, customerId, exportButton, showError, showSuccess) {
  // Check if FileMaker is available
  if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
    showError("FileMaker object is unavailable");
    exportButton.disabled = false;
    return;
  }
  
  try {
    // Call the FileMaker script with the base64 data and filename
    const payload = JSON.stringify({
      name: fileName,
      base64: base64Data,
      customerId: customerId,
      format: "email",
      action: "create" // Add required action key for FMGopher
    });
    
    FileMaker.PerformScript("save base64 from JS", payload);
    showSuccess("PDF report sent to FileMaker");
    
    // Re-enable the button after a short delay
    setTimeout(() => {
      exportButton.disabled = false;
    }, 1000);
  } catch (error) {
    showError(`Error sending PDF to FileMaker: ${error.message}`);
    exportButton.disabled = false;
  }
}

function ActivityReportModal({
  customer,
  isOpen,
  onClose
}) {
  // State for record editing
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { darkMode } = useTheme();
  const { showError, showSuccess } = useSnackBar();
  const { user } = useAppState();
  
  const {
    activityData,
    loadingActivity,
    activityTimeframe,
    setActivityTimeframe,
    customDateRange,
    setCustomDateRange,
    fetchActivity,
    processDataForReport
  } = useCustomerActivity();

  // Fetch activity data when the modal is opened or timeframe changes
  // Only fetch when timeframe changes if it's not 'custom' (which has its own Apply button)
  // Use a ref to track if this is the initial render
  const initialRenderRef = useRef(true);
  // Use a ref to track the previous timeframe
  const prevTimeframeRef = useRef(activityTimeframe);
  
  // Single effect to handle all cases
  useEffect(() => {
    // Skip the first render to prevent double fetching
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      // Initial fetch when modal opens
      if (isOpen && customer?.id && activityTimeframe !== 'custom') {
        console.log("Initial fetch for timeframe:", activityTimeframe);
        fetchActivity(customer);
      }
      return;
    }
    
    // For subsequent renders, only fetch if timeframe changed and it's not custom
    if (isOpen && customer?.id &&
        activityTimeframe !== 'custom' &&
        prevTimeframeRef.current !== activityTimeframe) {
      console.log("Timeframe changed from", prevTimeframeRef.current, "to", activityTimeframe);
      fetchActivity(customer);
    }
    
    // Update the previous timeframe ref
    prevTimeframeRef.current = activityTimeframe;
  }, [isOpen, customer, activityTimeframe]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        w-3/4 max-w-4xl max-h-[80vh] overflow-y-auto rounded-lg shadow-xl
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
        p-6
      `}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Activity Report: {customer.Name}</h2>
          <button
            onClick={onClose}
            className={`${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Timeframe Selector */}
        <div className={`
          flex space-x-4 mb-6 p-3 rounded-lg
          ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
        `}>
          <button
            onClick={() => setActivityTimeframe('unbilled')}
            className={`
              px-4 py-2 rounded-md transition-colors
              ${activityTimeframe === 'unbilled'
                ? 'bg-primary text-white'
                : darkMode
                  ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
            `}
          >
            Unbilled Activity
          </button>
          <button
            onClick={() => setActivityTimeframe('lastMonth')}
            className={`
              px-4 py-2 rounded-md transition-colors
              ${activityTimeframe === 'lastMonth'
                ? 'bg-primary text-white'
                : darkMode
                  ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
            `}
          >
            Last Month
          </button>
          <button
            onClick={() => setActivityTimeframe('custom')}
            className={`
              px-4 py-2 rounded-md transition-colors
              ${activityTimeframe === 'custom'
                ? 'bg-primary text-white'
                : darkMode
                  ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
            `}
          >
            Custom Range
          </button>
        </div>
        
        {/* Custom Date Range Selector */}
        {activityTimeframe === 'custom' && (
          <div className={`
            flex space-x-4 mb-6 p-4 rounded-lg
            ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
          `}>
            <div className="flex flex-col">
              <label className="mb-1 text-sm">Start Date</label>
              <input
                type="date"
                value={customDateRange.start || ''}
                onChange={(e) => setCustomDateRange({
                  ...customDateRange,
                  start: e.target.value
                })}
                className={`
                  px-3 py-2 rounded-md border
                  ${darkMode
                    ? 'bg-gray-600 border-gray-500 text-white'
                    : 'bg-white border-gray-300 text-gray-700'}
                `}
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-sm">End Date</label>
              <input
                type="date"
                value={customDateRange.end || ''}
                onChange={(e) => setCustomDateRange({
                  ...customDateRange,
                  end: e.target.value
                })}
                className={`
                  px-3 py-2 rounded-md border
                  ${darkMode
                    ? 'bg-gray-600 border-gray-500 text-white'
                    : 'bg-white border-gray-300 text-gray-700'}
                `}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => fetchActivity(customer)}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
              >
                Apply
              </button>
            </div>
          </div>
        )}
        
        {/* Activity Content */}
        <div className={`
          rounded-lg border
          ${darkMode ? 'border-gray-700' : 'border-gray-200'}
        `}>
          <table className="w-full">
            <thead className={`
              ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}
              border-b
              ${darkMode ? 'border-gray-600' : 'border-gray-200'}
            `}>
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {loadingActivity ? (
                <tr className={darkMode ? 'bg-gray-800' : 'bg-white'}>
                  <td colSpan="6" className="px-4 py-8 text-center">
                    <div className="text-lg font-medium">Loading activity data...</div>
                  </td>
                </tr>
              ) : activityData.length === 0 ? (
                <tr className={darkMode ? 'bg-gray-800' : 'bg-white'}>
                  <td colSpan="6" className="px-4 py-8 text-center">
                    <div className="text-lg font-medium mb-2">
                      {activityTimeframe === 'unbilled' && 'No Unbilled Activity'}
                      {activityTimeframe === 'lastMonth' && 'No Activity Last Month'}
                      {activityTimeframe === 'custom' && 'No Activity in Selected Range'}
                    </div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Try selecting a different timeframe or date range.
                    </div>
                  </td>
                </tr>
              ) : (
                activityData.map(record => (
                  <tr
                    key={record.id}
                    className={`
                      ${darkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'}
                      cursor-pointer
                    `}
                    onClick={() => {
                      console.log("Row clicked:", record);
                      console.log("Record billed status:", record.billed);
                      
                      // Allow editing all records, but mark billed ones for limited editing
                      console.log(record.billed ? "Record is billed, preparing for limited edit" : "Record is unbilled, preparing for full edit");
                      
                      // Convert the activity record to a format compatible with RecordModal
                      const recordForEdit = {
                        id: record.id,
                        recordId: record.recordId,
                        customer_id: record.customerId,
                        customers: { business_name: record.customerName },
                        project_id: record.projectId,
                        project_name: record.projectName,
                        product_name: record.description,
                        quantity: record.rawHours,
                        unit_price: record.rawHours > 0 ? record.rawAmount / record.rawHours : 0,
                        total_price: record.rawAmount,
                        date: record.rawDate,
                        inv_id: record.billed ? 'invoiced' : null,
                        // Add a flag to indicate if this is a billed record (for limited editing)
                        isBilled: record.billed
                      };
                      
                      console.log("Converted record for edit:", recordForEdit);
                      setSelectedRecord(recordForEdit);
                      setIsEditModalOpen(true);
                    }}
                  >
                    <td className="px-4 py-3">{record.date}</td>
                    <td className="px-4 py-3">{record.projectName}</td>
                    <td className="px-4 py-3">{record.description}</td>
                    <td className="px-4 py-3 text-right">{record.hours}</td>
                    <td className="px-4 py-3 text-right">{record.amount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`
                        px-2 py-1 text-xs rounded-full
                        ${record.billed
                          ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                          : (darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800')}
                      `}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className={`
              px-4 py-2 rounded-md mr-3
              ${darkMode
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
            `}
          >
            Close
          </button>
          <button
            onClick={(e) => {
              // Set a flag to prevent multiple clicks
              const exportButton = e.currentTarget;
              if (exportButton.disabled) return;
              exportButton.disabled = true;
              
              try {
                // Directly import from pdfReport.js instead of using pdfReportService
                import('../../utils/pdfReport.js').then(({ generateProjectActivityReport }) => {
                  
                  // Process the activity data to match the format expected by generateProjectActivityReport
                  const processedData = processDataForReport();
                  
                  // Generate the report using the activity data
                  const fileName = `${customer.Name.replace(/\s+/g, '-').toLowerCase()}-activity-report.pdf`;
                  console.log(`Generating report with filename: ${fileName}`);
                  
                  // Generate the report with options
                  generateProjectActivityReport(
                    processedData,
                    {
                      title: `Activity Report: ${customer.Name}`,
                      dateRange: activityTimeframe === 'unbilled'
                        ? 'Unbilled Activity'
                        : activityTimeframe === 'lastMonth'
                          ? 'Last Month'
                          : 'Custom Date Range',
                      fileName: fileName
                    }
                  ).then(report => {
                    console.log("Report generated, preparing to send");
                    
                    // Get the PDF as bytes and convert to base64
                    return report.output('bytes').then(pdfBytes => {
                      // Convert bytes to base64
                      const base64Data = btoa(
                        new Uint8Array(pdfBytes)
                          .reduce((data, byte) => data + String.fromCharCode(byte), '')
                      );
                      
                      // First try to send via email if Mailjet is configured
                      if (isMailjetConfigured()) {
                        console.log("Mailjet is configured, attempting to send email");
                        
                        // Create HTML content using the template function
                        const htmlContent = createHtmlEmailTemplate({
                          title: `Activity Report: ${customer.Name}`,
                          mainText: `Please find attached the activity report for ${customer.Name}.\n\nThis report contains a summary of all project activities for the selected time period.`,
                          footerText: "This report was generated automatically by the Clarity CRM system."
                        });

                        console.log({customer})
                        
                        // Check if customer email is valid before sending
                        if (!isValidEmail(customer.Email)) {
                          showError(`Cannot send email: Invalid or missing email address "${customer.Email || ''}"`);
                          exportButton.disabled = false;
                          return;
                        }
                        
                        const emailOptions = {
                          to: customer.Email,
                          subject: `Activity Report: ${customer.Name}`,
                          text: `Please find attached the activity report for ${customer.Name}.\n\nThis report contains a summary of all project activities for the selected time period.`,
                          html: htmlContent,
                          customerName: customer.Name,
                          senderName: user?.userName || user?.name || 'Charlie - AI Assistant',
                          senderEmail: user?.userEmail || user?.email || 'noreply@claritybusinesssolutions.ca',
                          attachment: {
                            filename: fileName,
                            content: base64Data
                          }
                        };
                        
                        // Send email with attachment
                        return sendEmailWithAttachment(emailOptions).then(result => {
                          console.log("Email send result:", result);
                          
                          if (result.success) {
                            showSuccess("PDF report sent via email");
                            
                            // Re-enable the button after a short delay
                            setTimeout(() => {
                              exportButton.disabled = false;
                            }, 1000);
                          } else {
                            // Show error and confirmation dialog for fallback
                            showError(`Failed to send email: ${result.error}`);
                            
                            // Show confirmation dialog for fallback
                            if (confirm(`Would you like to save the report using FileMaker instead?`)) {
                              // Fallback to FileMaker workflow
                              sendToFileMaker(base64Data, fileName, customer.id, exportButton, showError, showSuccess);
                            } else {
                              exportButton.disabled = false;
                            }
                          }
                        }).catch(error => {
                          // Show confirmation dialog for fallback
                          if (confirm(`Error sending email: ${error.message}. Would you like to save the report using FileMaker instead?`)) {
                            // Fallback to FileMaker workflow
                            sendToFileMaker(base64Data, fileName, customer.id, exportButton, showError, showSuccess);
                          } else {
                            showError(`Error sending email: ${error.message}`);
                            exportButton.disabled = false;
                          }
                        });
                      } else {
                        // Use FileMaker workflow directly
                        sendToFileMaker(base64Data, fileName, customer.id, exportButton, showError, showSuccess);
                      }
                    });
                  }).catch(error => {
                    showError(`Error generating report: ${error.message}`);
                    exportButton.disabled = false;
                  });
                }).catch(error => {
                  showError(`Error importing PDF module: ${error.message}`);
                  exportButton.disabled = false;
                });
              } catch (error) {
                showError(`Error generating PDF: ${error.message}`);
                exportButton.disabled = false;
              }
            }}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors duration-150"
          >
            Export Report
          </button>
        </div>
      </div>
      
      {/* Edit Record Modal */}
      {isEditModalOpen && selectedRecord && (
        <RecordModal
          record={selectedRecord}
          onClose={() => setIsEditModalOpen(false)}
          onSave={async (updatedRecord) => {
            try {
              // Update the record in FileMaker
              console.log("Saving updated record:", updatedRecord);
              
              // For billed records, only update the description field
              if (selectedRecord.isBilled) {
                console.log("Billed record - only updating description");
                // Create a modified record with only the fields we want to update
                const limitedUpdate = {
                  id: updatedRecord.id,
                  recordId: updatedRecord.recordId,
                  product_name: updatedRecord.product_name, // Only update the description
                  // Keep original values for other fields
                  quantity: selectedRecord.quantity,
                  unit_price: selectedRecord.unit_price,
                  total_price: selectedRecord.total_price,
                  date: selectedRecord.date,
                  inv_id: selectedRecord.inv_id
                };
                
                await updateActivityRecord(limitedUpdate);
              } else {
                // For unbilled records, update all fields
                await updateActivityRecord(updatedRecord);
              }
              
              // Close the modal
              setIsEditModalOpen(false);
              
              // Refresh the activity data
              fetchActivity(customer);
              
              // Show success message
              showSuccess("Record updated successfully");
            } catch (error) {
              console.error("Error updating record:", error);
              showError(`Error updating record: ${error.message}`);
            }
          }}
          darkMode={darkMode}
          // Pass a flag to indicate if this is a billed record (for limited editing)
          limitedEdit={selectedRecord.isBilled}
        />
      )}
    </div>
  );
}

ActivityReportModal.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string.isRequired,
    Email: PropTypes.string
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export default ActivityReportModal;