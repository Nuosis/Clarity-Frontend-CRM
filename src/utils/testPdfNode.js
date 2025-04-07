/**
 * Node.js test script for PDF functionality
 * This file can be run directly with Node.js to test the PDF generation
 */

// Import required modules
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test function to generate a simple PDF with a table
 * @returns {Object} The generated PDF document
 */
function testPdfGeneration() {
  console.log('Starting PDF test generation');
  
  try {
    // Initialize PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    console.log('PDF document initialized');
    
    // Check if autoTable is available on the prototype
    if (typeof jsPDF.prototype.autoTable !== 'function') {
      console.log('autoTable is not available on jsPDF prototype, applying manually');
      jsPDF.prototype.autoTable = function(...args) {
        return autoTable(this, ...args);
      };
    }
    
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
    
    // Instead of using doc.autoTable, use the imported autoTable function directly
    console.log('Using autoTable function directly with doc as first parameter');
    
    // Add a simple table using the imported autoTable function
    autoTable(doc, {
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
    
    // Save the PDF to a file
    const pdfOutput = doc.output();
    const outputPath = path.join(__dirname, 'test-output.pdf');
    fs.writeFileSync(outputPath, pdfOutput, 'binary');
    console.log(`PDF saved to: ${outputPath}`);
    
    return {
      success: true,
      path: outputPath
    };
  } catch (error) {
    console.error('Error generating test PDF:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Print information about the jsPDF and autoTable modules
 */
function printModuleInfo() {
  console.log('=== MODULE INFO ===');
  console.log('jsPDF version:', jsPDF.version || 'unknown');
  console.log('jsPDF constructor available:', typeof jsPDF === 'function');
  console.log('autoTable available:', typeof autoTable === 'function');
  console.log('autoTable on jsPDF prototype:', typeof jsPDF.prototype.autoTable === 'function');
  console.log('===================');
}

// Run the test when this file is executed directly
console.log('=== PDF TEST SCRIPT ===');
printModuleInfo();
const result = testPdfGeneration();
console.log('Test result:', result);
console.log('======================');