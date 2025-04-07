/**
 * Test runner for PDF functionality
 * This file provides a simple way to test the PDF generation functionality
 */

import { testPdfGeneration } from './testPdf.js';

/**
 * Run the PDF test and log the results
 */
export function runPdfTest() {
  console.log('=== PDF TEST RUNNER ===');
  console.log('Starting PDF test...');
  
  try {
    // Test if jsPDF is available
    import('jspdf').then(jsPDF => {
      console.log('jsPDF imported successfully:', !!jsPDF);
      console.log('jsPDF version:', jsPDF.version || 'unknown');
      console.log('jsPDF constructor:', !!jsPDF.jsPDF);
      
      // Test if jspdf-autotable is available
      import('jspdf-autotable').then(autoTable => {
        console.log('jspdf-autotable imported successfully:', !!autoTable);
        console.log('autoTable default export:', !!autoTable.default);
        
        // Create a test instance
        const doc = new jsPDF.jsPDF();
        console.log('jsPDF instance created successfully');
        
        // Check if autoTable is available on the instance
        console.log('autoTable available on instance:', typeof doc.autoTable === 'function');
        
        // Check if autoTable is available on the prototype
        console.log('autoTable available on prototype:', typeof jsPDF.jsPDF.prototype.autoTable === 'function');
        
        // Try to run the test
        console.log('Running PDF generation test...');
        const result = testPdfGeneration();
        console.log('PDF generation test completed successfully:', !!result);
        
        console.log('=== TEST COMPLETE ===');
      }).catch(error => {
        console.error('Error importing jspdf-autotable:', error);
      });
    }).catch(error => {
      console.error('Error importing jsPDF:', error);
    });
  } catch (error) {
    console.error('Error in PDF test runner:', error);
  }
}

// Export a function to manually apply the autoTable plugin
export function applyAutoTablePlugin() {
  try {
    import('jspdf').then(jsPDF => {
      import('jspdf-autotable').then(autoTableModule => {
        // Get the autoTable function
        const autoTable = autoTableModule.default;
        
        // Check if it's already applied
        if (typeof jsPDF.jsPDF.prototype.autoTable !== 'function') {
          console.log('Manually applying autoTable plugin to jsPDF prototype');
          
          // Apply the plugin manually
          jsPDF.jsPDF.prototype.autoTable = function(...args) {
            return autoTable(this, ...args);
          };
          
          console.log('autoTable plugin applied successfully');
        } else {
          console.log('autoTable plugin is already applied');
        }
      });
    });
  } catch (error) {
    console.error('Error applying autoTable plugin:', error);
  }
}

// If this file is run directly, execute the test
if (typeof window !== 'undefined') {
  console.log('Attaching PDF test runner to window object');
  window.pdfTestRunner = {
    runPdfTest,
    applyAutoTablePlugin
  };
}