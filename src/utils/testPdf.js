/**
 * Test file for PDF generation
 * This file tests the jsPDF and jspdf-autotable functionality in isolation
 */

// Import jsPDF and autoTable
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Test function to generate a simple PDF with a table
 * @returns {Object} The generated PDF document
 */
export function testPdfGeneration() {
  console.log('Starting PDF test generation');
  
  try {
    // Initialize PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    console.log('PDF document initialized');
    
    // Set document properties
    doc.setProperties({
      title: 'Test PDF',
      subject: 'Testing jsPDF and autoTable',
      author: 'Test Script',
      keywords: 'test, pdf, autotable',
      creator: 'Test Script'
    });
    
    // Add a title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Test PDF with AutoTable', 105, 15, { align: 'center' });
    
    console.log('Adding table to PDF');
    
    // Test if autoTable is available
    if (typeof doc.autoTable !== 'function') {
      console.error('ERROR: doc.autoTable is not a function!');
      console.log('doc object keys:', Object.keys(doc));
      console.log('jsPDF prototype keys:', Object.keys(jsPDF.prototype));
      throw new Error('autoTable is not available on the jsPDF instance');
    }
    
    // Add a simple table
    doc.autoTable({
      startY: 30,
      head: [['ID', 'Name', 'Value']],
      body: [
        ['1', 'Test Item 1', '$100.00'],
        ['2', 'Test Item 2', '$200.00'],
        ['3', 'Test Item 3', '$300.00']
      ],
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      }
    });
    
    console.log('Table added successfully');
    
    // Return the PDF document
    return {
      blob: doc.output('blob'),
      buffer: doc.output('arraybuffer'),
      fileName: 'test-pdf.pdf',
      save: () => doc.save('test-pdf.pdf'),
      output: (type) => doc.output(type)
    };
  } catch (error) {
    console.error('Error generating test PDF:', error);
    throw error;
  }
}

/**
 * Function to test PDF generation and download
 */
export function testPdfDownload() {
  try {
    console.log('Testing PDF generation and download');
    const pdf = testPdfGeneration();
    
    // Create a download link
    const blob = pdf.blob;
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'test-pdf.pdf';
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log('PDF download initiated');
    return true;
  } catch (error) {
    console.error('Error in PDF download test:', error);
    return false;
  }
}

// If this file is run directly, execute the test
if (typeof window !== 'undefined') {
  console.log('Running PDF test in browser environment');
  window.testPdf = {
    testPdfGeneration,
    testPdfDownload
  };
  console.log('PDF test functions attached to window.testPdf');
}