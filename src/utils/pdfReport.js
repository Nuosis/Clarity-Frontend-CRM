/**
 * PDF Report Generation Module
 * 
 * This module provides functionality to generate PDF reports from project activity data
 * using jsPDF and jspdf-autotable.
 */

import { jsPDF } from 'jspdf';
import { formatCurrency } from '../services';
import { ensureAutoTableAvailable } from './pdfUtils';

// Ensure autoTable is available on the jsPDF prototype
ensureAutoTableAvailable();

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
 * @returns {Object} PDF document as a blob or buffer
 */
export function generateProjectActivityReport(projectData, options = {}) {
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
  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4'
  });

  // Set document properties
  doc.setProperties({
    title: title,
    subject: 'Project Activity Report',
    author: 'Clarity CRM',
    keywords: 'project, activity, report',
    creator: 'Clarity CRM'
  });

  // Add report header
  addReportHeader(doc, title, dateRange);

  // Process each project
  const projectIds = Object.keys(projectData);
  
  projectIds.forEach((projectId, index) => {
    const project = projectData[projectId];
    
    // Add page break if not the first project
    if (index > 0) {
      doc.addPage();
    }
    
    // Add project summary
    addProjectSummary(doc, project);
    
    // Filter records based on options
    const records = project.records.filter(record => {
      if (record.billed && !includeBilled) return false;
      if (!record.billed && !includeUnbilled) return false;
      return true;
    });
    
    // Add activity table
    addActivityTable(doc, records);
  });

  // Return the PDF document
  return {
    blob: doc.output('blob'),
    buffer: doc.output('arraybuffer'),
    fileName: fileName,
    save: () => doc.save(fileName),
    output: (type) => doc.output(type)
  };
}

/**
 * Adds a header to the report
 * 
 * @param {Object} doc - jsPDF document
 * @param {string} title - Report title
 * @param {string} dateRange - Date range for the report
 */
function addReportHeader(doc, title, dateRange) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 15, { align: 'center' });
  
  // Add date range
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date Range: ${dateRange}`, pageWidth / 2, 22, { align: 'center' });
  
  // Add generation timestamp
  const timestamp = `Generated: ${new Date().toLocaleString()}`;
  doc.setFontSize(10);
  doc.text(timestamp, pageWidth / 2, 28, { align: 'center' });
  
  // Add horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(10, 32, pageWidth - 10, 32);
}

/**
 * Adds project summary information to the report
 * 
 * @param {Object} doc - jsPDF document
 * @param {Object} project - Project data
 */
function addProjectSummary(doc, project) {
  const startY = 40;
  const leftMargin = 15;
  
  // Project name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Project: ${project.projectName}`, leftMargin, startY);
  
  // Customer name
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Customer: ${project.customerName}`, leftMargin, startY + 7);
  
  // Project totals
  doc.setFontSize(11);
  doc.text(`Total Hours: ${project.totalHours.toFixed(2)}`, leftMargin, startY + 14);
  doc.text(`Total Amount: ${formatCurrency(project.totalAmount)}`, leftMargin, startY + 21);
  
  // Add horizontal line
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, startY + 25, pageWidth - leftMargin, startY + 25);
}

/**
 * Adds activity table to the report
 * 
 * @param {Object} doc - jsPDF document
 * @param {Array} records - Activity records
 */
function addActivityTable(doc, records) {
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
  
  // Add table to document
  doc.autoTable({
    startY: 70,
    head: [['Date', 'Hours', 'Amount', 'Billed', 'Description']],
    body: tableData,
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { cellWidth: 25 },  // Date
      1: { cellWidth: 15, halign: 'right' },  // Hours
      2: { cellWidth: 25, halign: 'right' },  // Amount
      3: { cellWidth: 15, halign: 'center' },  // Billed
      4: { cellWidth: 'auto' }  // Description
    },
    margin: { top: 70, right: 15, bottom: 15, left: 15 },
    didDrawPage: (data) => {
      // Add page number at the bottom
      const pageCount = doc.internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(10);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }
  });
}

/**
 * Generates a detailed PDF report for a single project
 * 
 * @param {Object} project - Project data with activity records
 * @param {Object} options - Report generation options
 * @returns {Object} PDF document as a blob or buffer
 */
export function generateDetailedProjectReport(project, options = {}) {
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