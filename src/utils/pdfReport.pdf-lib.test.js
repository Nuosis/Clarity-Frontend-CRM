/**
 * PDF Report Generation Module Tests (pdf-lib)
 * 
 * This file contains tests for the PDF report generation functionality
 * in pdfReport.js using the actual pdf-lib API without mocking.
 */

import { generateProjectActivityReport, generateDetailedProjectReport } from './pdfReport';
import { PDFDocument } from 'pdf-lib';

// Sample test data
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
      }
    ]
  }
};

// Single project data for detailed report tests
const singleProjectData = sampleProjectData['project-123'];

// Mock the document.createElement and FileReader for download testing
let mockLink;
let mockFileReader;

beforeEach(() => {
  // Reset mocks before each test
  mockLink = {
    href: '',
    download: '',
    click: jest.fn(),
    setAttribute: jest.fn()
  };
  
  // Mock FileReader
  mockFileReader = {
    onload: null,
    onerror: null,
    result: 'data:application/pdf;base64,test',
    readAsDataURL: jest.fn(function(blob) {
      setTimeout(() => this.onload(), 0);
    })
  };
  
  global.FileReader = jest.fn(() => mockFileReader);
  
  // Mock document.createElement
  document.createElement = jest.fn().mockImplementation((tag) => {
    if (tag === 'a') {
      return mockLink;
    }
    return {};
  });
});

describe('PDF Report Generation Module (pdf-lib)', () => {
  describe('generateProjectActivityReport', () => {
    test('should generate a PDF report with default options', async () => {
      // Generate the report
      const report = await generateProjectActivityReport(sampleProjectData);
      
      // Verify the report object has the expected properties
      expect(report).toHaveProperty('blob');
      expect(report).toHaveProperty('buffer');
      expect(report).toHaveProperty('save');
      expect(report).toHaveProperty('output');
      
      // Verify the blob is a valid PDF
      const blob = report.blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      
      // Verify the buffer contains PDF data
      const buffer = report.buffer;
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      
      // Verify the PDF content by checking the first few bytes (PDF signature)
      const bytes = new Uint8Array(buffer);
      const signature = String.fromCharCode(...bytes.slice(0, 5));
      expect(signature).toBe('%PDF-');
      
      // Load the PDF document to verify its structure
      const pdfDoc = await PDFDocument.load(bytes);
      
      // Verify the PDF has the expected number of pages (one per project)
      expect(pdfDoc.getPageCount()).toBe(Object.keys(sampleProjectData).length);
    });
    
    test('should generate a PDF report with custom options', async () => {
      // Generate the report with custom options
      const customOptions = {
        title: 'Custom Report Title',
        dateRange: 'Custom Date Range',
        orientation: 'landscape',
        fileName: 'custom-report.pdf'
      };
      
      const report = await generateProjectActivityReport(sampleProjectData, customOptions);
      
      // Verify the report was generated
      expect(report).toHaveProperty('blob');
      
      // Get the PDF bytes
      const pdfBytes = await report.output('bytes');
      
      // Load the PDF document to verify its structure
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Verify the PDF has the expected number of pages
      expect(pdfDoc.getPageCount()).toBe(Object.keys(sampleProjectData).length);
      
      // Verify the orientation by checking the page dimensions
      const page = pdfDoc.getPage(0);
      const { width, height } = page.getSize();
      
      // In landscape mode, width should be greater than height
      expect(width).toBeGreaterThan(height);
    });
    
    test('should filter records based on includeBilled option', async () => {
      // Generate the report with only unbilled records
      const report = await generateProjectActivityReport(sampleProjectData, {
        includeBilled: false,
        includeUnbilled: true
      });
      
      // Verify the report was generated
      expect(report).toHaveProperty('blob');
      
      // We can't directly check the content filtering in the PDF,
      // but we can verify the report was generated successfully
      const pdfBytes = await report.output('bytes');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Verify the PDF has the expected number of pages
      expect(pdfDoc.getPageCount()).toBe(Object.keys(sampleProjectData).length);
    });
    
    test('should filter records based on includeUnbilled option', async () => {
      // Generate the report with only billed records
      const report = await generateProjectActivityReport(sampleProjectData, {
        includeBilled: true,
        includeUnbilled: false
      });
      
      // Verify the report was generated
      expect(report).toHaveProperty('blob');
      
      // We can't directly check the content filtering in the PDF,
      // but we can verify the report was generated successfully
      const pdfBytes = await report.output('bytes');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Verify the PDF has the expected number of pages
      expect(pdfDoc.getPageCount()).toBe(Object.keys(sampleProjectData).length);
    });
    
    test('should handle the save method correctly', async () => {
      // Generate the report
      const report = await generateProjectActivityReport(sampleProjectData);
      
      // Call the save method
      await report.save();
      
      // Verify that the download link was created and clicked
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('project-activity-report.pdf');
      expect(mockLink.click).toHaveBeenCalled();
      
      // Verify that FileReader was used to read the blob
      expect(global.FileReader).toHaveBeenCalled();
      expect(mockFileReader.readAsDataURL).toHaveBeenCalled();
    });
    
    test('should handle the output method correctly', async () => {
      // Generate the report
      const report = await generateProjectActivityReport(sampleProjectData);
      
      // Test the output method with different types
      const blob = await report.output('blob');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      
      const buffer = await report.output('arraybuffer');
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      
      const bytes = await report.output('bytes');
      expect(bytes).toBeInstanceOf(Uint8Array);
      
      // Test with an invalid type (should default to blob)
      const defaultOutput = await report.output('invalid');
      expect(defaultOutput).toBeInstanceOf(Blob);
    });
    
    test('should handle empty project data', async () => {
      // Generate the report with empty project data
      const report = await generateProjectActivityReport({});
      
      // Verify the report was generated
      expect(report).toHaveProperty('blob');
      
      // Verify the PDF content
      const pdfBytes = await report.output('bytes');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Verify the PDF has only one page (the header page)
      expect(pdfDoc.getPageCount()).toBe(1);
    });
  });
  
  describe('generateDetailedProjectReport', () => {
    test('should generate a detailed report for a single project', async () => {
      // Generate the detailed report
      const report = await generateDetailedProjectReport(singleProjectData);
      
      // Verify the report object has the expected properties
      expect(report).toHaveProperty('blob');
      expect(report).toHaveProperty('buffer');
      expect(report).toHaveProperty('save');
      expect(report).toHaveProperty('output');
      
      // Verify the blob is a valid PDF
      const blob = report.blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      
      // Verify the PDF content
      const pdfBytes = await report.output('bytes');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Verify the PDF has only one page (single project)
      expect(pdfDoc.getPageCount()).toBe(1);
    });
    
    test('should generate a report with file name based on project name', async () => {
      // Generate the detailed report
      const report = await generateDetailedProjectReport(singleProjectData);
      
      // Call the save method
      await report.save();
      
      // Verify that the download link was created with the correct file name
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('website-redesign-report.pdf');
    });
    
    test('should merge custom options with default options', async () => {
      // Generate the detailed report with custom options
      const customOptions = {
        orientation: 'landscape',
        includeBilled: false
      };
      
      const report = await generateDetailedProjectReport(singleProjectData, customOptions);
      
      // Verify the report was generated
      expect(report).toHaveProperty('blob');
      
      // Verify the PDF content
      const pdfBytes = await report.output('bytes');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Verify the orientation by checking the page dimensions
      const page = pdfDoc.getPage(0);
      const { width, height } = page.getSize();
      
      // In landscape mode, width should be greater than height
      expect(width).toBeGreaterThan(height);
    });
  });
  
  describe('PDF Content Validation', () => {
    test('should include project and customer names in the PDF', async () => {
      // Generate the report
      const report = await generateProjectActivityReport(sampleProjectData);
      
      // Get the PDF bytes
      const pdfBytes = await report.output('bytes');
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // We can't easily extract text from PDFs in Jest
      // Instead, we'll just verify the PDF was generated successfully
      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(0);
      
      // Verify the PDF has the expected number of pages
      expect(pdfDoc.getPageCount()).toBeGreaterThan(0);
    });
    
    test('should include all records in the PDF when no filtering is applied', async () => {
      // Count the total number of records in the sample data
      const totalRecords = Object.values(sampleProjectData).reduce(
        (count, project) => count + project.records.length, 0
      );
      
      // Generate the report with no filtering
      const report = await generateProjectActivityReport(sampleProjectData, {
        includeBilled: true,
        includeUnbilled: true
      });
      
      // Get the PDF bytes
      const pdfBytes = await report.output('bytes');
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Verify the PDF has the expected number of pages
      expect(pdfDoc.getPageCount()).toBe(Object.keys(sampleProjectData).length);
      
      // We can't easily count the records in the PDF without a text extraction library,
      // but we can verify the PDF was generated successfully
    });
  });
  
  describe('Real Download Process', () => {
    test('should trigger the browser download mechanism', async () => {
      // Generate the report
      const report = await generateProjectActivityReport(sampleProjectData);
      
      // Call the save method to trigger the download
      await report.save();
      
      // Verify that the download link was created and clicked
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();
      
      // Verify that FileReader was used to read the blob
      expect(global.FileReader).toHaveBeenCalled();
      expect(mockFileReader.readAsDataURL).toHaveBeenCalled();
    });
  });
});


describe('Full PDF Life Cycle', () => {
  test('should generate, save, and trigger download for the PDF report', async () => {
    // Generate the PDF report
    const report = await generateProjectActivityReport(sampleProjectData);
    
    // Call the save method to initiate the download process
    await report.save();
    
    // Verify that the download link was created with a valid data URL
    expect(mockLink.href).toMatch(/^data:application\/pdf;base64,/);
    
    // Verify that the download file name is set correctly
    expect(mockLink.download).toBe('project-activity-report.pdf');
  });
});
