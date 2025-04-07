# PDF Report Generation Module

This module provides functionality to generate PDF reports from project activity data using jsPDF and jspdf-autotable.

## Features

- Generate PDF reports from project activity data grouped by project
- Support for both multi-project and single-project reports
- Customizable report options (title, date range, orientation, etc.)
- Filtering options for billed/unbilled activities
- Clean, professional formatting with tables, headers, and page numbers
- Returns the PDF as a blob, buffer, or file that can be saved or sent

## Installation

The module requires the following dependencies:

```bash
npm install jspdf jspdf-autotable
```

## Usage

### Basic Usage

```javascript
import { generateProjectActivityReport } from '../utils/pdfReport';

// Sample project activity data
const projectData = {
  'project-123': {
    projectId: 'project-123',npm install
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
        description: 'Initial design mockups'
      },
      // More records...
    ]
  },
  // More projects...
};

// Generate the report
const report = generateProjectActivityReport(projectData, {
  title: 'Monthly Project Activity Report',
  dateRange: 'March 1, 2025 - March 31, 2025',
  fileName: 'monthly-project-report.pdf'
});

// Save the PDF file
report.save();

// Or get the PDF as a blob or buffer
const pdfBlob = report.blob;
const pdfBuffer = report.buffer;
```

### Detailed Project Report

```javascript
import { generateDetailedProjectReport } from '../utils/pdfReport';

// Sample project data
const projectData = {
  projectId: 'project-123',
  projectName: 'Website Redesign',
  customerName: 'Acme Corporation',
  totalHours: 45.5,
  totalAmount: 6825.00,
  records: [
    // Activity records...
  ]
};

// Generate a detailed report for a single project
const report = generateDetailedProjectReport(projectData, {
  dateRange: 'March 1, 2025 - March 31, 2025',
  includeBilled: true,
  includeUnbilled: true,
  orientation: 'landscape'
});

// Save the PDF file
report.save();
```

### Integration with Financial Service

```javascript
import { generateCustomerProjectReport } from '../utils/pdfReportTest';
import { useFinancialRecords } from '../hooks/useFinancialRecords';

function ReportButton({ customerId }) {
  const { financialRecords, loading } = useFinancialRecords();
  
  const handleGenerateReport = async () => {
    if (loading || !financialRecords) return;
    
    try {
      const report = await generateCustomerProjectReport(
        { response: { data: financialRecords } },
        customerId,
        { includeBilled: true, includeUnbilled: true }
      );
      
      // Save the PDF file
      report.save();
    } catch (error) {
      console.error('Error generating report:', error);
      // Show error message to user
    }
  };
  
  return (
    <button 
      onClick={handleGenerateReport}
      disabled={loading}
      className="px-4 py-2 bg-primary text-white rounded-md"
    >
      Generate PDF Report
    </button>
  );
}
```

## API Reference

### `generateProjectActivityReport(projectData, options)`

Generates a PDF report from project activity data.

#### Parameters

- `projectData` (Object): Project activity data grouped by project
- `options` (Object, optional): Report generation options
  - `title` (string): Report title (default: 'Project Activity Report')
  - `dateRange` (string): Date range for the report (default: current date)
  - `includeBilled` (boolean): Whether to include billed activities (default: true)
  - `includeUnbilled` (boolean): Whether to include unbilled activities (default: true)
  - `orientation` (string): Page orientation: 'portrait' or 'landscape' (default: 'portrait')
  - `fileName` (string): File name for saving the PDF (default: 'project-activity-report.pdf')

#### Returns

- Object with the following properties:
  - `blob`: PDF document as a Blob
  - `buffer`: PDF document as an ArrayBuffer
  - `save()`: Function to save the PDF file
  - `output(type)`: Function to output the PDF in various formats

### `generateDetailedProjectReport(project, options)`

Generates a detailed PDF report for a single project.

#### Parameters

- `project` (Object): Project data with activity records
- `options` (Object, optional): Same options as `generateProjectActivityReport`

#### Returns

- Same as `generateProjectActivityReport`

## Data Structure

The module expects project data in the following structure:

```javascript
{
  'project-id-1': {
    projectId: 'project-id-1',
    projectName: 'Project Name',
    customerName: 'Customer Name',
    totalHours: 45.5,
    totalAmount: 6825.00,
    records: [
      {
        id: 'record-id-1',
        date: '2025-03-15', // Date string in any format parseable by new Date()
        hours: 8.0,         // Number of hours
        amount: 1200.00,    // Amount in currency units
        billed: true,       // Boolean indicating if the activity has been billed
        description: 'Activity description'
      },
      // More records...
    ]
  },
  // More projects...
}
```

## Example Files

- `pdfReportExample.js`: Contains example functions demonstrating how to use the module
- `pdfReportTest.js`: Provides test functions for generating reports with real data from the application
- `ProjectReportButton.jsx`: React component for integrating the report generation into the UI

## Integration Examples

See the `ProjectDetailsWithReport.jsx` file for an example of how to integrate the PDF report generation functionality into an existing component.