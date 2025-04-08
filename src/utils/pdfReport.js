/**
 * PDF Report Generation Module
 *
 * This module provides functionality to generate PDF reports from project activity data
 * using pdf-lib.
 */

import { rgb } from 'pdf-lib';
import { formatCurrency } from '../services';
import { createPdf, drawTable, downloadPdf } from './pdfUtils';

/**
 * Generates a PDF report from project activity data
 *
 * @param {Object} projectData - Project activity data grouped by project
 * @param {Object} options - Report generation options
 * @param {string} options.title - Report title
 * @param {string} options.dateRange - Date range for the report (e.g., "Jan 1, 2025 - Apr 7, 2025")
 * @param {boolean} options.includeBilled - Whether to include billed activities (default: true)
 * @param {boolean} options.includeUnbilled - Whether to include unbilled activities (default: true)
 * @param {string} options.orientation - Page orientation: 'portrait' or 'landscape' (default: 'portrait')
 * @returns {Promise<Object>} PDF document as a blob or buffer
 */
export async function generateProjectActivityReport(projectData, options = {}) {
  // Set default options
  const {
    title = 'Project Activity Report',
    dateRange = new Date().toLocaleDateString(),
    includeBilled = true,
    includeUnbilled = true,
    orientation = 'portrait',
    fileName = 'project-activity-report.pdf'
  } = options;

  // Initialize PDF document
  const doc = await createPdf({
    orientation: orientation,
    format: 'a4'
  });

  // Add report header
  await addReportHeader(doc, title, dateRange);

  // Process each project
  const projectIds = Object.keys(projectData);
  
  for (let i = 0; i < projectIds.length; i++) {
    const projectId = projectIds[i];
    const project = projectData[projectId];
    
    // Add page break if not the first project
    if (i > 0) {
      doc.addPage();
    }
    
    // Add project summary
    await addProjectSummary(doc, project);
    
    // Filter records based on options
    const records = project.records.filter(record => {
      if (record.billed && !includeBilled) return false;
      if (!record.billed && !includeUnbilled) return false;
      return true;
    });
    
    // Add activity table
    await addActivityTable(doc, records);
  }

  // Save the PDF document
  const pdfData = await doc.save(fileName);

  // Return the PDF document
  return {
    ...pdfData,
    fileName: fileName, // Add fileName to the returned object
    save: async () => {
      const data = await doc.save(fileName);
      await downloadPdf({
        blob: data.blob,
        fileName: fileName
      });
      return true;
    },
    output: async (type) => {
      if (type === 'blob') return pdfData.blob;
      if (type === 'arraybuffer') return pdfData.buffer;
      if (type === 'bytes') return pdfData.bytes;
      return pdfData.blob;
    }
  };
}

/**
 * Adds a header to the report
 *
 * @param {Object} doc - PDF document object
 * @param {string} title - Report title
 * @param {string} dateRange - Date range for the report
 */
async function addReportHeader(doc, title, dateRange) {
  const pageWidth = doc.pageSize[0];
  const centerX = pageWidth / 2;
  
  // Add title
  doc.drawText(title, centerX, doc.pageSize[1] - 15, {
    font: 'helveticaBold',
    size: 18,
    align: 'center'
  });
  
  // Add date range
  doc.drawText(`Date Range: ${dateRange}`, centerX, doc.pageSize[1] - 30, {
    font: 'helvetica',
    size: 12,
    align: 'center'
  });
  
  // Add generation timestamp
  const timestamp = `Generated: ${new Date().toLocaleString()}`;
  doc.drawText(timestamp, centerX, doc.pageSize[1] - 45, {
    font: 'helvetica',
    size: 10,
    align: 'center'
  });
  
  // Add horizontal line
  doc.drawLine(
    50,
    doc.pageSize[1] - 55,
    pageWidth - 50,
    doc.pageSize[1] - 55,
    {
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    }
  );
}

/**
 * Adds project summary information to the report
 *
 * @param {Object} doc - PDF document object
 * @param {Object} project - Project data
 */
async function addProjectSummary(doc, project) {
  const startY = doc.pageSize[1] - 80;
  const leftMargin = 50;
  
  // Project name
  doc.drawText(`Project: ${project.projectName}`, leftMargin, startY, {
    font: 'helveticaBold',
    size: 14
  });
  
  // Customer name
  doc.drawText(`Customer: ${project.customerName}`, leftMargin, startY - 20, {
    font: 'helvetica',
    size: 12
  });
  
  // Project totals
  doc.drawText(`Total Hours: ${project.totalHours.toFixed(2)}`, leftMargin, startY - 40, {
    font: 'helvetica',
    size: 11
  });
  
  doc.drawText(`Total Amount: ${formatCurrency(project.totalAmount)}`, leftMargin, startY - 60, {
    font: 'helvetica',
    size: 11
  });
  
  // Add horizontal line
  const pageWidth = doc.pageSize[0];
  doc.drawLine(
    leftMargin,
    startY - 70,
    pageWidth - leftMargin,
    startY - 70,
    {
      thickness: 0.3,
      color: rgb(0.86, 0.86, 0.86)
    }
  );
}

/**
 * Adds activity table to the report
 *
 * @param {Object} doc - PDF document object
 * @param {Array} records - Activity records
 */
async function addActivityTable(doc, records) {
  // Sort records by date
  const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Prepare table data
  const tableData = sortedRecords.map(record => [
    formatDate(record.date),
    record.hours.toFixed(2),
    formatCurrency(record.amount),
    record.billed ? 'Yes' : 'No',
    record.description || ''
  ]);
  
  // Define column widths based on content
  const columnWidths = [80, 60, 80, 60, 220]; // Adjust these values based on your needs
  
  // Add table to document
  await drawTable(doc,
    ['Date', 'Hours', 'Amount', 'Billed', 'Description'],
    tableData,
    {
      x: 50,
      y: doc.pageSize[1] - 150,
      width: doc.pageSize[0] - 100,
      columnWidths: columnWidths,
      headerColor: rgb(0.26, 0.54, 0.79), // #428bca
      alternateRowColor: rgb(0.96, 0.96, 0.96) // #f5f5f5
    }
  );
  
  // Add page numbers at the bottom of each page
  const pageCount = doc.pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.pdfDoc.getPage(i);
    const pageWidth = page.getSize().width;
    const pageHeight = page.getSize().height;
    
    page.drawText(`Page ${i + 1} of ${pageCount}`, {
      x: pageWidth / 2 - 40,
      y: 30,
      size: 10,
      font: doc.fonts.helvetica
    });
  }
}

/**
 * Generates a detailed PDF report for a single project
 *
 * @param {Object} project - Project data with activity records
 * @param {Object} options - Report generation options
 * @returns {Promise<Object>} PDF document as a blob or buffer
 */
export async function generateDetailedProjectReport(project, options = {}) {
  // Create a wrapper object to use the main report function
  const projectData = {
    [project.projectId]: project
  };
  
  // Set default options for detailed report
  const defaultOptions = {
    title: `${project.projectName} - Detailed Activity Report`,
    fileName: `${project.projectName.replace(/\s+/g, '-').toLowerCase()}-report.pdf`
  };
  
  return generateProjectActivityReport(projectData, { ...defaultOptions, ...options });
}

/**
 * Formats a date string for display in the report
 *
 * @param {string} dateString - Date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}