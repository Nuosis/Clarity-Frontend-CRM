/**
 * PDF Report Generation Example
 * 
 * This file demonstrates how to use the PDF report generation module.
 */

import { generateProjectActivityReport, generateDetailedProjectReport } from './pdfReport';

/**
 * Example function demonstrating how to generate a PDF report from project activity data
 */
export function generateExampleReport() {
  // Sample project activity data grouped by project
  const sampleProjectData = {
    'project-123': {
      projectId: 'project-123',
      projectName: 'Website Redesign',
      customerName: 'Acme Corporation',
      totalHours: 45.5,
      totalAmount: 6825.00,
      records: [
        {
          id: 'record-1',
          date: '2025-03-15',
          hours: 8.0,
          amount: 1200.00,
          billed: true,
          description: 'Initial design mockups and wireframes'
        },
        {
          id: 'record-2',
          date: '2025-03-18',
          hours: 6.5,
          amount: 975.00,
          billed: true,
          description: 'Frontend implementation of homepage'
        },
        {
          id: 'record-3',
          date: '2025-03-22',
          hours: 7.0,
          amount: 1050.00,
          billed: false,
          description: 'Responsive design implementation'
        }
      ]
    },
    'project-456': {
      projectId: 'project-456',
      projectName: 'Mobile App Development',
      customerName: 'TechStart Inc.',
      totalHours: 32.0,
      totalAmount: 4800.00,
      records: [
        {
          id: 'record-4',
          date: '2025-03-10',
          hours: 8.0,
          amount: 1200.00,
          billed: true,
          description: 'App architecture planning'
        },
        {
          id: 'record-5',
          date: '2025-03-12',
          hours: 10.0,
          amount: 1500.00,
          billed: true,
          description: 'Core functionality implementation'
        },
        {
          id: 'record-6',
          date: '2025-03-25',
          hours: 14.0,
          amount: 2100.00,
          billed: false,
          description: 'UI implementation and testing'
        }
      ]
    }
  };

  // Generate a multi-project report
  const multiProjectReport = generateProjectActivityReport(sampleProjectData, {
    title: 'Monthly Project Activity Report',
    dateRange: 'March 1, 2025 - March 31, 2025',
    fileName: 'monthly-project-report.pdf'
  });

  // Generate a detailed report for a single project
  const singleProject = sampleProjectData['project-123'];
  const detailedReport = generateDetailedProjectReport(singleProject, {
    dateRange: 'March 1, 2025 - March 31, 2025',
    includeBilled: true,
    includeUnbilled: true,
    orientation: 'landscape'
  });

  // Return both reports
  return {
    multiProjectReport,
    detailedReport
  };
}

/**
 * Example of how to use the report generation with real data from the application
 * 
 * @param {Object} projectsData - Projects data from the application
 * @param {string} dateRange - Date range for the report
 * @returns {Object} Generated PDF report
 */
export function generateReportFromAppData(projectsData, dateRange) {
  // Format the data for the report generator
  const formattedData = {};
  
  // Process each project
  Object.values(projectsData).forEach(project => {
    if (project.records && project.records.length > 0) {
      formattedData[project.projectId] = {
        projectId: project.projectId,
        projectName: project.projectName,
        customerName: project.customerName,
        totalHours: project.totalHours || 0,
        totalAmount: project.totalAmount || 0,
        records: project.records.map(record => ({
          id: record.id,
          date: record.date,
          hours: record.hours || 0,
          amount: record.amount || 0,
          billed: record.billed || false,
          description: record.description || ''
        }))
      };
    }
  });
  
  // Generate the report
  return generateProjectActivityReport(formattedData, {
    title: 'Project Activity Report',
    dateRange: dateRange,
    fileName: 'project-activity-report.pdf'
  });
}

/**
 * Example of how to integrate with the financial service
 * 
 * @param {Array} financialRecords - Financial records from the financial service
 * @param {string} dateRange - Date range for the report
 * @returns {Object} Generated PDF report
 */
export function generateReportFromFinancialRecords(financialRecords, dateRange) {
  // Import the groupRecordsByProject function from the financial service
  // This is just for demonstration - in a real implementation, you would
  // import this function from the financial service
  const { groupRecordsByProject } = require('../services/financialService');
  
  // Group the records by project
  const groupedByProject = groupRecordsByProject(financialRecords);
  
  // Generate the report
  return generateProjectActivityReport(groupedByProject, {
    title: 'Financial Activity Report',
    dateRange: dateRange,
    fileName: 'financial-activity-report.pdf'
  });
}